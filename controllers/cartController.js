// ============================================================
// CONTROLADOR: CARRITO DE COMPRAS (cartController.js)
// ============================================================
// Maneja todas las operaciones del carrito de compras:
// ver contenido, agregar items, actualizar cantidades,
// eliminar items y vaciar carrito.
//
// RELACIÓN CON DIAGRAMAS DEL PROYECTO:
//   - Casos de Uso (imagen 2): "Agregar al Carrito", "Ver Carrito",
//     "Modificar Cantidad", "Eliminar del Carrito"
//   - ERD (imagen 4): Tablas "carrito_compras" (1:1 con usuarios)
//     y "detalle_carrito" (N:M entre carrito y productos)
//   - Diagrama de Secuencia (imagen 5): El carrito es el paso previo
//     a la creación del pedido en el proceso de compra
//   - Diagrama de Clases (imagen.png): Clase "Carrito_Compras"
//     con relación a "Detalle_Carrito"
//
// ARQUITECTURA DE TABLAS:
//   carrito_compras: Un registro por usuario (1:1)
//     → Creado automáticamente al registrar el usuario (authController)
//     → id_usuario es UNIQUE (un solo carrito por usuario)
//
//   detalle_carrito: Un registro por cada producto en el carrito
//     → Relación con carrito_compras via id_carrito
//     → Relación con gestion_productos via id_producto
//     → UNIQUE(id_carrito, id_producto) evita duplicados
//     → Si el producto ya está en el carrito, se suma la cantidad
//
// RELACIÓN CON OTROS ARCHIVOS:
//   - routes/cartRoutes.js → URLs que llaman a estas funciones
//   - controllers/authController.js → Crea el carrito al registrar
//   - controllers/orderController.js → Usa el carrito para crear pedidos
//   - middleware/auth.js → Todas las rutas requieren isAuthenticated
//   - middleware/validators.js → validateCartItem valida id_producto y cantidad
// ============================================================

const { pool } = require('../config/db');

// ============================================================
// VER CARRITO
// ============================================================
// Devuelve el contenido del carrito del usuario autenticado,
// incluyendo detalles de cada producto (nombre, precio, imagen)
// y cálculos de subtotales y total.
//
// CONSULTA CON JOIN:
//   Necesitamos datos de 3 tablas:
//   1. carrito_compras → Para obtener el id_carrito del usuario
//   2. detalle_carrito → Para obtener los productos y cantidades
//   3. gestion_productos → Para obtener nombre, precio, imagen
//
//   Se usan JOINs para combinar estas tablas en una sola consulta.
//   Es más eficiente que hacer 3 consultas separadas.
//
// CÁLCULO DE SUBTOTAL:
//   subtotal = precio × cantidad (calculado con SQL: p.precio * dc.cantidad)
//   total = suma de todos los subtotales
//
// RUTA: GET /api/carrito
// MIDDLEWARE: isAuthenticated
// ============================================================
const verCarrito = async (req, res) => {
  try {
    const userId = req.session.userId;

    // --- Paso 1: Obtener el carrito del usuario ---
    const [carritos] = await pool.query(
      'SELECT id_carrito FROM carrito_compras WHERE id_usuario = ?',
      [userId]
    );

    // Si no tiene carrito (no debería pasar, se crea al registrar)
    if (carritos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Carrito no encontrado. Contacte soporte.',
        data: null,
        errors: null
      });
    }

    const idCarrito = carritos[0].id_carrito;

    // --- Paso 2: Obtener items del carrito con datos del producto ---
    // JOIN entre detalle_carrito y gestion_productos
    // (p.precio * dc.cantidad) AS subtotal → calcula el subtotal por línea
    const [items] = await pool.query(
      `SELECT 
        dc.id_detalle_carrito,
        dc.id_producto,
        dc.cantidad,
        p.nombre,
        p.precio,
        p.stock,
        p.imagen_url,
        p.talla,
        p.color,
        (p.precio * dc.cantidad) AS subtotal
      FROM detalle_carrito dc
      INNER JOIN gestion_productos p ON dc.id_producto = p.id_producto
      WHERE dc.id_carrito = ?
      ORDER BY dc.id_detalle_carrito ASC`,
      [idCarrito]
    );

    // --- Paso 3: Calcular el total del carrito ---
    // reduce() suma todos los subtotales
    // parseFloat asegura que trabajamos con números, no strings
    const total = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

    return res.status(200).json({
      success: true,
      message: items.length > 0 ? 'Carrito obtenido exitosamente.' : 'El carrito está vacío.',
      data: {
        id_carrito: idCarrito,
        items: items,
        totalItems: items.length,
        total: parseFloat(total.toFixed(2)) // Redondear a 2 decimales
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al ver carrito:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener el carrito.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// ============================================================
// AGREGAR ITEM AL CARRITO
// ============================================================
// Agrega un producto al carrito o incrementa su cantidad si
// ya existe.
//
// FLUJO:
//   1. validateCartItem (middleware) ya validó id_producto y cantidad
//   2. Verificar que el producto exista y esté activo
//   3. Verificar que haya stock suficiente
//   4. Obtener el carrito del usuario
//   5. Si el producto ya está en el carrito → sumar cantidad
//   6. Si no está → insertar nuevo registro en detalle_carrito
//
// TÉCNICA: INSERT ... ON DUPLICATE KEY UPDATE
//   MySQL tiene esta cláusula que combina INSERT y UPDATE.
//   Si el registro ya existe (violación de UNIQUE), ejecuta el UPDATE.
//   Esto es más eficiente que hacer SELECT + IF + INSERT/UPDATE.
//   Funciona gracias al UNIQUE(id_carrito, id_producto) en schema.sql.
//
// RUTA: POST /api/carrito/agregar
// MIDDLEWARE: isAuthenticated + validateCartItem
// ============================================================
const agregarItem = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id_producto, cantidad } = req.body;
    const cantidadNum = parseInt(cantidad);

    // --- Paso 1: Verificar que el producto exista y esté activo ---
    const [productos] = await pool.query(
      'SELECT id_producto, nombre, stock, activo FROM gestion_productos WHERE id_producto = ?',
      [id_producto]
    );

    if (productos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado.',
        data: null,
        errors: null
      });
    }

    const producto = productos[0];

    // Verificar que el producto esté activo
    if (!producto.activo) {
      return res.status(400).json({
        success: false,
        message: 'Este producto no está disponible actualmente.',
        data: null,
        errors: null
      });
    }

    // --- Paso 2: Obtener el carrito del usuario ---
    const [carritos] = await pool.query(
      'SELECT id_carrito FROM carrito_compras WHERE id_usuario = ?',
      [userId]
    );

    if (carritos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Carrito no encontrado. Contacte soporte.',
        data: null,
        errors: null
      });
    }

    const idCarrito = carritos[0].id_carrito;

    // --- Paso 3: Verificar cantidad actual en el carrito ---
    // Si el producto ya está en el carrito, la nueva cantidad total
    // será la actual + la que se quiere agregar
    const [existente] = await pool.query(
      'SELECT id_detalle_carrito, cantidad FROM detalle_carrito WHERE id_carrito = ? AND id_producto = ?',
      [idCarrito, id_producto]
    );

    const cantidadActual = existente.length > 0 ? existente[0].cantidad : 0;
    const cantidadTotal = cantidadActual + cantidadNum;

    // --- Paso 4: Verificar stock ---
    if (cantidadTotal > producto.stock) {
      return res.status(400).json({
        success: false,
        message: `Stock insuficiente. Disponible: ${producto.stock}, en carrito: ${cantidadActual}, solicitado: ${cantidadNum}.`,
        data: null,
        errors: [{ field: 'cantidad', message: 'Stock insuficiente' }]
      });
    }

    // --- Paso 5: Insertar o actualizar ---
    // ON DUPLICATE KEY UPDATE aprovecha el UNIQUE(id_carrito, id_producto)
    // Si ya existe, suma la cantidad; si no, inserta un nuevo registro
    await pool.query(
      `INSERT INTO detalle_carrito (id_carrito, id_producto, cantidad) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad)`,
      [idCarrito, id_producto, cantidadNum]
    );

    return res.status(200).json({
      success: true,
      message: `"${producto.nombre}" agregado al carrito (cantidad: ${cantidadTotal}).`,
      data: {
        id_producto: id_producto,
        nombre: producto.nombre,
        cantidad_en_carrito: cantidadTotal
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al agregar item:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al agregar al carrito.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// ============================================================
// ACTUALIZAR CANTIDAD DE UN ITEM
// ============================================================
// Cambia la cantidad de un producto específico en el carrito.
// A diferencia de agregar (que suma), esto ESTABLECE la cantidad.
//
// VALIDACIONES:
//   1. El item debe pertenecer al carrito del usuario actual
//      (previene que un usuario modifique el carrito de otro)
//   2. La nueva cantidad debe tener stock suficiente
//   3. La cantidad debe ser mayor a 0
//
// RUTA: PUT /api/carrito/actualizar/:idDetalle
// MIDDLEWARE: isAuthenticated
// ============================================================
const actualizarCantidad = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { idDetalle } = req.params;
    const { cantidad } = req.body;
    const cantidadNum = parseInt(cantidad);

    // Validar que la cantidad sea un número válido
    if (!cantidad || isNaN(cantidadNum) || cantidadNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser un número entero mayor a 0.',
        data: null,
        errors: [{ field: 'cantidad', message: 'Cantidad inválida' }]
      });
    }

    // --- Paso 1: Verificar que el item pertenezca al usuario ---
    // JOIN con carrito_compras para verificar propiedad
    const [items] = await pool.query(
      `SELECT dc.id_detalle_carrito, dc.id_producto, dc.cantidad
       FROM detalle_carrito dc
       INNER JOIN carrito_compras cc ON dc.id_carrito = cc.id_carrito
       WHERE dc.id_detalle_carrito = ? AND cc.id_usuario = ?`,
      [idDetalle, userId]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item no encontrado en su carrito.',
        data: null,
        errors: null
      });
    }

    // --- Paso 2: Verificar stock ---
    const [productos] = await pool.query(
      'SELECT stock, nombre FROM gestion_productos WHERE id_producto = ?',
      [items[0].id_producto]
    );

    if (cantidadNum > productos[0].stock) {
      return res.status(400).json({
        success: false,
        message: `Stock insuficiente para "${productos[0].nombre}". Disponible: ${productos[0].stock}.`,
        data: null,
        errors: [{ field: 'cantidad', message: 'Stock insuficiente' }]
      });
    }

    // --- Paso 3: Actualizar la cantidad ---
    await pool.query(
      'UPDATE detalle_carrito SET cantidad = ? WHERE id_detalle_carrito = ?',
      [cantidadNum, idDetalle]
    );

    return res.status(200).json({
      success: true,
      message: `Cantidad actualizada a ${cantidadNum}.`,
      data: {
        id_detalle_carrito: parseInt(idDetalle),
        nueva_cantidad: cantidadNum
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al actualizar cantidad:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al actualizar cantidad.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// ============================================================
// ELIMINAR UN ITEM DEL CARRITO
// ============================================================
// Remueve un producto específico del carrito.
// Se verifica la propiedad del item antes de eliminar.
//
// RUTA: DELETE /api/carrito/eliminar/:idDetalle
// MIDDLEWARE: isAuthenticated
// ============================================================
const eliminarItem = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { idDetalle } = req.params;

    // --- Verificar que el item pertenezca al usuario ---
    const [items] = await pool.query(
      `SELECT dc.id_detalle_carrito
       FROM detalle_carrito dc
       INNER JOIN carrito_compras cc ON dc.id_carrito = cc.id_carrito
       WHERE dc.id_detalle_carrito = ? AND cc.id_usuario = ?`,
      [idDetalle, userId]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item no encontrado en su carrito.',
        data: null,
        errors: null
      });
    }

    // --- Eliminar el item ---
    await pool.query(
      'DELETE FROM detalle_carrito WHERE id_detalle_carrito = ?',
      [idDetalle]
    );

    return res.status(200).json({
      success: true,
      message: 'Producto eliminado del carrito.',
      data: null,
      errors: null
    });

  } catch (error) {
    console.error('Error al eliminar item:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al eliminar del carrito.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// ============================================================
// VACIAR CARRITO
// ============================================================
// Elimina TODOS los productos del carrito del usuario.
// El carrito en sí (tabla carrito_compras) permanece, solo
// se borran los registros de detalle_carrito.
//
// NOTA: Esto también se ejecuta internamente al crear un pedido
// (orderController.crearPedido), pero aquí es para cuando el
// usuario quiere vaciar su carrito manualmente.
//
// RUTA: DELETE /api/carrito/vaciar
// MIDDLEWARE: isAuthenticated
// ============================================================
const vaciarCarrito = async (req, res) => {
  try {
    const userId = req.session.userId;

    // --- Obtener el carrito del usuario ---
    const [carritos] = await pool.query(
      'SELECT id_carrito FROM carrito_compras WHERE id_usuario = ?',
      [userId]
    );

    if (carritos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Carrito no encontrado.',
        data: null,
        errors: null
      });
    }

    // --- Eliminar todos los items del carrito ---
    const [result] = await pool.query(
      'DELETE FROM detalle_carrito WHERE id_carrito = ?',
      [carritos[0].id_carrito]
    );

    return res.status(200).json({
      success: true,
      message: `Carrito vaciado. Se eliminaron ${result.affectedRows} producto(s).`,
      data: {
        itemsEliminados: result.affectedRows
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al vaciar carrito:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al vaciar carrito.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// ============================================================
// EXPORTAR CONTROLADORES
// ============================================================
module.exports = {
  verCarrito,
  agregarItem,
  actualizarCantidad,
  eliminarItem,
  vaciarCarrito
};

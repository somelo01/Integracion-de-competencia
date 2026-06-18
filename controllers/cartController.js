// Controlador carrito: gestiona ver, agregar, actualizar y vaciar carrito.
// Todas las rutas usan isAuthenticated y validan ítems en middleware.

const { pool } = require('../config/db');

// verCarrito: devuelve el carrito del usuario con sus subtotales y total.
// Uso: GET /api/carrito
// Middleware: isAuthenticated
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

// agregarItem: añade un producto al carrito o actualiza su cantidad.
// Uso: POST /api/carrito/agregar
// Middleware: isAuthenticated + validateCartItem
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

// actualizarCantidad: ajusta la cantidad de un item en el carrito.
// Uso: PUT /api/carrito/actualizar/:idDetalle
// Middleware: isAuthenticated
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

// eliminarItem: borra un item del carrito del usuario.
// Uso: DELETE /api/carrito/eliminar/:idDetalle
// Middleware: isAuthenticated
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

// VACIAR CARRITO
// Elimina todos los items del carrito del usuario.
// RUTA: DELETE /api/carrito/vaciar
// MIDDLEWARE: isAuthenticated
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

// Exportar controladores
module.exports = {
  verCarrito,
  agregarItem,
  actualizarCantidad,
  eliminarItem,
  vaciarCarrito
};

// ============================================================
// CONTROLADOR: PEDIDOS (orderController.js)
// ============================================================
// Maneja la creación y gestión de pedidos (órdenes de compra).
// Un pedido se crea a partir del carrito de compras y representa
// una intención de compra que luego se paga con Webpay.
//
// RELACIÓN CON DIAGRAMAS DEL PROYECTO:
//   - Casos de Uso (imagen 2): "Realizar Compra", "Ver Historial
//     de Pedidos", "Cancelar Pedido"
//   - ERD (imagen 4): Tablas "pedidos" y "detalle_pedido"
//   - Diagrama de Secuencia (imagen 5): Flujo completo del proceso
//     de compra: Carrito → Pedido → Pago → Factura
//   - Diagrama de Estados (imagen 3): Estados del pedido:
//     Pendiente → Aprobado → Enviado → Entregado
//     Pendiente → Cancelado / Rechazado
//
// OPERACIONES CON TRANSACCIONES:
//   crearPedido y cancelarPedido usan TRANSACCIONES MySQL.
//
//   ¿QUÉ ES UNA TRANSACCIÓN?
//   Es un grupo de operaciones que se ejecutan como una unidad.
//   Si TODAS las operaciones tienen éxito → se confirman (COMMIT).
//   Si ALGUNA falla → se revierten TODAS (ROLLBACK).
//
//   Ejemplo en crearPedido:
//     1. Insertar en pedidos //     2. Insertar en detalle_pedido //     3. Descontar stock (si falla aquí, se deshace 1 y 2)
//     4. Vaciar carrito //     → COMMIT (todo se guarda)
//
//   Sin transacciones, si el paso 3 falla, el pedido quedaría
//   creado pero el stock no descontado → datos inconsistentes.
//
// RELACIÓN CON OTROS ARCHIVOS:
//   - routes/orderRoutes.js → URLs que llaman estas funciones
//   - controllers/cartController.js → El pedido se crea del carrito
//   - controllers/paymentController.js → Después de crear el pedido
//     se redirige a Webpay para el pago
//   - middleware/auth.js → Todas las rutas requieren sesión
//   - config/db.js → Pool para consultas y transacciones
// ============================================================

const { pool } = require('../config/db');

// ============================================================
// CREAR PEDIDO (desde el carrito)
// ============================================================
// Convierte el contenido del carrito en un pedido formal.
// Esta es la operación más compleja del sistema y usa
// una TRANSACCIÓN MySQL para garantizar consistencia.
//
// FLUJO DETALLADO (Diagrama de Secuencia - imagen 5):
//   1. Verificar que el carrito NO esté vacío
//   2. Obtener todos los items del carrito con precios actuales
//   3. Verificar stock de CADA producto
//   4. Calcular el total del pedido
//   5. INICIAR TRANSACCIÓN
//   6. Insertar registro en tabla 'pedidos' (estado: Pendiente)
//   7. Insertar cada item en tabla 'detalle_pedido'
//   8. Descontar stock de cada producto
//   9. Vaciar el carrito (eliminar detalle_carrito)
//   10. COMMIT → Todo se guarda
//   (Si algo falla entre 5-9 → ROLLBACK → nada se guarda)
//
// ¿POR QUÉ GUARDAR precio_unitario EN detalle_pedido?
//   El admin puede cambiar el precio de un producto después.
//   Si solo guardamos el id_producto, el historial mostraría
//   el precio nuevo, no el que pagó el cliente. Guardar
//   precio_unitario preserva la integridad histórica.
//
// RUTA: POST /api/pedidos/crear
// MIDDLEWARE: isAuthenticated
// ============================================================
const crearPedido = async (req, res) => {
  // Variable para la conexión de transacción
  // Se declara fuera del try para poder hacer rollback en el catch
  let connection;

  try {
    const userId = req.session.userId;

    // --- Paso 1: Obtener el carrito del usuario ---
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

    const idCarrito = carritos[0].id_carrito;

    // --- Paso 2: Obtener items del carrito con datos del producto ---
    const [items] = await pool.query(
      `SELECT 
        dc.id_producto, 
        dc.cantidad, 
        p.nombre, 
        p.precio, 
        p.stock, 
        p.activo
       FROM detalle_carrito dc
       INNER JOIN gestion_productos p ON dc.id_producto = p.id_producto
       WHERE dc.id_carrito = ?`,
      [idCarrito]
    );

    // Verificar que el carrito no esté vacío
    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El carrito está vacío. Agregue productos antes de crear un pedido.',
        data: null,
        errors: null
      });
    }

    // --- Paso 3: Verificar stock y productos activos ---
    const erroresStock = [];
    for (const item of items) {
      if (!item.activo) {
        erroresStock.push({
          producto: item.nombre,
          message: `"${item.nombre}" ya no está disponible.`
        });
      } else if (item.cantidad > item.stock) {
        erroresStock.push({
          producto: item.nombre,
          message: `Stock insuficiente para "${item.nombre}". Disponible: ${item.stock}, solicitado: ${item.cantidad}.`
        });
      }
    }

    if (erroresStock.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede crear el pedido. Hay problemas con algunos productos.',
        data: null,
        errors: erroresStock
      });
    }

    // --- Paso 4: Calcular el total ---
    const total = items.reduce((sum, item) => {
      return sum + (parseFloat(item.precio) * item.cantidad);
    }, 0);

    // =====================================================
    // PASO 5: INICIAR TRANSACCIÓN
    // =====================================================
    // getConnection() obtiene una conexión individual del pool.
    // Esto es necesario porque las transacciones deben ejecutarse
    // en la MISMA conexión (beginTransaction, commit, rollback).
    // Con pool.query() cada consulta podría usar una conexión
    // diferente, rompiendo la transacción.
    // =====================================================
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // --- Paso 6: Insertar el pedido ---
    const [pedidoResult] = await connection.query(
      'INSERT INTO pedidos (id_usuario, total) VALUES (?, ?)',
      [userId, parseFloat(total.toFixed(2))]
    );

    const idPedido = pedidoResult.insertId;

    // --- Paso 7: Insertar cada detalle del pedido ---
    // Guardamos el precio_unitario actual para integridad histórica
    for (const item of items) {
      await connection.query(
        'INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
        [idPedido, item.id_producto, item.cantidad, item.precio]
      );
    }

    // --- Paso 8: Descontar stock de cada producto ---
    for (const item of items) {
      await connection.query(
        'UPDATE gestion_productos SET stock = stock - ? WHERE id_producto = ?',
        [item.cantidad, item.id_producto]
      );
    }

    // --- Paso 9: Vaciar el carrito ---
    await connection.query(
      'DELETE FROM detalle_carrito WHERE id_carrito = ?',
      [idCarrito]
    );

    // --- Paso 10: COMMIT → confirmar todas las operaciones ---
    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Pedido creado exitosamente. Proceda al pago.',
      data: {
        id_pedido: idPedido,
        total: parseFloat(total.toFixed(2)),
        estado: 'Pendiente',
        totalItems: items.length
      },
      errors: null
    });

  } catch (error) {
    // --- ROLLBACK si algo falló ---
    // Deshace TODAS las operaciones de la transacción
    if (connection) {
      await connection.rollback();
    }

    console.error('Error al crear pedido:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al crear pedido.',
      data: null,
      errors: [{ message: error.message }]
    });

  } finally {
    // --- Liberar la conexión siempre ---
    // finally se ejecuta SIEMPRE (éxito o error)
    // release() devuelve la conexión al pool para reutilizarla
    if (connection) {
      connection.release();
    }
  }
};

// ============================================================
// LISTAR PEDIDOS DEL USUARIO (con paginación)
// ============================================================
// Devuelve el historial de pedidos del usuario autenticado.
// Incluye paginación para manejar usuarios con muchos pedidos.
//
// SEGURIDAD: Solo devuelve pedidos del usuario de la sesión.
// Un usuario NO puede ver los pedidos de otro usuario.
//
// RUTA: GET /api/pedidos?page=1&limit=10
// MIDDLEWARE: isAuthenticated
// ============================================================
const listarPedidos = async (req, res) => {
  try {
    const userId = req.session.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Contar total de pedidos del usuario
    const [countResult] = await pool.query(
      'SELECT COUNT(*) AS total FROM pedidos WHERE id_usuario = ?',
      [userId]
    );
    const totalPedidos = countResult[0].total;

    // Obtener pedidos paginados, ordenados por fecha (más recientes primero)
    const [pedidos] = await pool.query(
      'SELECT id_pedido, fecha_pedido, estado, total FROM pedidos WHERE id_usuario = ? ORDER BY fecha_pedido DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );

    const totalPaginas = Math.ceil(totalPedidos / limit);

    return res.status(200).json({
      success: true,
      message: pedidos.length > 0 ? 'Pedidos obtenidos exitosamente.' : 'No tiene pedidos aún.',
      data: {
        pedidos: pedidos,
        paginacion: {
          paginaActual: page,
          totalPaginas: totalPaginas,
          totalPedidos: totalPedidos,
          pedidosPorPagina: limit
        }
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al listar pedidos:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener pedidos.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// ============================================================
// OBTENER DETALLE DE UN PEDIDO
// ============================================================
// Devuelve la información completa de un pedido incluyendo
// todos sus productos (detalle_pedido + gestion_productos).
//
// JOIN:
//   pedidos → detalle_pedido → gestion_productos
//   Esto permite obtener el nombre e imagen del producto junto
//   con la cantidad y precio_unitario del momento de la compra.
//
// SEGURIDAD: Verificamos que el pedido pertenezca al usuario.
//
// RUTA: GET /api/pedidos/:id
// MIDDLEWARE: isAuthenticated
// ============================================================
const obtenerPedido = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;

    // --- Obtener el pedido verificando propiedad ---
    const [pedidos] = await pool.query(
      'SELECT id_pedido, id_usuario, fecha_pedido, estado, total FROM pedidos WHERE id_pedido = ? AND id_usuario = ?',
      [id, userId]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado.',
        data: null,
        errors: null
      });
    }

    // --- Obtener los detalles del pedido con datos del producto ---
    const [detalles] = await pool.query(
      `SELECT 
        dp.id_detalle, 
        dp.id_producto, 
        dp.cantidad, 
        dp.precio_unitario,
        (dp.precio_unitario * dp.cantidad) AS subtotal,
        p.nombre,
        p.imagen_url,
        p.talla,
        p.color
       FROM detalle_pedido dp
       INNER JOIN gestion_productos p ON dp.id_producto = p.id_producto
       WHERE dp.id_pedido = ?`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: 'Pedido obtenido exitosamente.',
      data: {
        pedido: pedidos[0],
        detalles: detalles
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al obtener pedido:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener pedido.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// ============================================================
// CANCELAR PEDIDO
// ============================================================
// Permite al usuario cancelar un pedido que esté en estado
// 'Pendiente'. Los demás estados no se pueden cancelar desde
// el lado del cliente.
//
// FLUJO (con TRANSACCIÓN):
//   1. Verificar que el pedido exista y pertenezca al usuario
//   2. Verificar que el estado sea 'Pendiente'
//   3. INICIAR TRANSACCIÓN
//   4. Obtener los detalles del pedido
//   5. Restaurar el stock de cada producto
//   6. Cambiar el estado del pedido a 'Cancelado'
//   7. COMMIT
//
// ¿POR QUÉ RESTAURAR STOCK?
//   Cuando se creó el pedido, se descontó el stock de cada
//   producto. Al cancelar, debemos devolverlo para que esas
//   unidades vuelvan a estar disponibles para otros clientes.
//
// CORRESPONDE A: Diagrama de Estados (imagen 3)
//   Transición: Pendiente → Cancelado
//
// RUTA: PUT /api/pedidos/:id/cancelar
// MIDDLEWARE: isAuthenticated
// ============================================================
const cancelarPedido = async (req, res) => {
  let connection;

  try {
    const userId = req.session.userId;
    const { id } = req.params;

    // --- Paso 1: Verificar propiedad y estado ---
    const [pedidos] = await pool.query(
      'SELECT id_pedido, estado FROM pedidos WHERE id_pedido = ? AND id_usuario = ?',
      [id, userId]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado.',
        data: null,
        errors: null
      });
    }

    // --- Paso 2: Solo se puede cancelar si está Pendiente ---
    if (pedidos[0].estado !== 'Pendiente') {
      return res.status(400).json({
        success: false,
        message: `No se puede cancelar un pedido en estado "${pedidos[0].estado}". Solo pedidos "Pendiente" pueden cancelarse.`,
        data: null,
        errors: null
      });
    }

    // --- Paso 3: INICIAR TRANSACCIÓN ---
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // --- Paso 4: Obtener detalles para restaurar stock ---
    const [detalles] = await connection.query(
      'SELECT id_producto, cantidad FROM detalle_pedido WHERE id_pedido = ?',
      [id]
    );

    // --- Paso 5: Restaurar stock de cada producto ---
    for (const detalle of detalles) {
      await connection.query(
        'UPDATE gestion_productos SET stock = stock + ? WHERE id_producto = ?',
        [detalle.cantidad, detalle.id_producto]
      );
    }

    // --- Paso 6: Cambiar estado a Cancelado ---
    await connection.query(
      'UPDATE pedidos SET estado = ? WHERE id_pedido = ?',
      ['Cancelado', id]
    );

    // --- Paso 7: COMMIT ---
    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Pedido cancelado exitosamente. El stock ha sido restaurado.',
      data: {
        id_pedido: parseInt(id),
        nuevo_estado: 'Cancelado'
      },
      errors: null
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Error al cancelar pedido:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al cancelar pedido.',
      data: null,
      errors: [{ message: error.message }]
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ============================================================
// EXPORTAR CONTROLADORES
// ============================================================
module.exports = {
  crearPedido,
  listarPedidos,
  obtenerPedido,
  cancelarPedido
};

// Controlador pedidos: maneja creación y seguimiento de pedidos.
// Usa transacciones MySQL para garantizar consistencia de compra.

const { pool } = require('../config/db');

// crearPedido: convierte el carrito en un pedido y actualiza el stock.
// Uso: POST /api/pedidos/crear
// Middleware: isAuthenticated
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

    // Iniciar transacción en una conexión dedicada.
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

// Listar pedidos del usuario con paginación.
// Solo devuelve pedidos del usuario autenticado.
// RUTA: GET /api/pedidos?page=1&limit=10
// MIDDLEWARE: isAuthenticated
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

// Obtener detalle de un pedido con sus productos.
// Verifica que el pedido pertenezca al usuario.
// RUTA: GET /api/pedidos/:id
// MIDDLEWARE: isAuthenticated
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

// Cancelar pedido Pendiente y restaurar stock en transacción.
// RUTA: PUT /api/pedidos/:id/cancelar
// MIDDLEWARE: isAuthenticated
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

// Exportar controladores
module.exports = {
  crearPedido,
  listarPedidos,
  obtenerPedido,
  cancelarPedido
};

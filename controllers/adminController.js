// CONTROLADOR ADMINISTRACIÓN 
// Maneja las operaciones del panel de administración.
// Incluye gestión de productos, usuarios, pedidos, soporte y dashboard.

// RELACIÓN CON DIAGRAMAS DEL PROYECTO:
// Casos de Uso del Admin: todos los casos de uso del lado derecho del diagrama
// ERD: Acceso a todas las tablas del sistema
// Diagrama de Secuencia: Devolución/Reembolso
// Diagrama de Estados: Transiciones de pedidos

// SEGURIDAD:
// Todas las rutas de admin pasan por isAuthenticated e isAdmin

const { pool } = require('../config/db');


// LISTAR TODOS LOS PRODUCTOS
// Muestra todos los productos 
const listarTodosProductos = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.query(
      'SELECT COUNT(*) AS total FROM gestion_productos'
    );
    const totalProductos = countResult[0].total;

    const [productos] = await pool.query(
      'SELECT id_producto, nombre, categoria, precio, stock, talla, color, descripcion, imagen_url, activo, fecha_creacion FROM gestion_productos ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const totalPaginas = Math.ceil(totalProductos / limit);

    return res.status(200).json({
      success: true,
      message: 'Productos obtenidos exitosamente.',
      data: {
        productos: productos,
        paginacion: {
          paginaActual: page,
          totalPaginas: totalPaginas,
          totalProductos: totalProductos,
          productosPorPagina: limit
        }
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al listar productos (admin):', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// CREAR PRODUCTO
// Agrega un nuevo producto al catálogo
// FLUJO:
// validateProduct ya validó nombre, categoría, precio y stock
// Insertar el producto en la tabla 'gestion_productos'
// El producto se crea como activo=1 por defecto
const crearProducto = async (req, res) => {
  try {
    const { nombre, categoria, precio, stock, talla, color, descripcion, imagen_url } = req.body;

    const [result] = await pool.query(
      `INSERT INTO gestion_productos 
        (nombre, categoria, precio, stock, talla, color, descripcion, imagen_url) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        categoria,
        parseFloat(precio),
        parseInt(stock),
        talla || null,
        color || null,
        descripcion || null,
        imagen_url || null
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente.',
      data: {
        id_producto: result.insertId,
        nombre: nombre,
        categoria: categoria,
        precio: parseFloat(precio),
        stock: parseInt(stock)
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al crear producto:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al crear producto.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// EDITAR PRODUCTO
// Actualiza los datos de un producto existente dinámicamente
// FLUJO:
// Verificar que el producto exista
// Construir consulta dinámica con los campos enviados
// Ejecutar UPDATE
const editarProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, categoria, precio, stock, talla, color, descripcion, imagen_url } = req.body;

    const [existente] = await pool.query(
      'SELECT id_producto FROM gestion_productos WHERE id_producto = ?',
      [id]
    );

    if (existente.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado.',
        data: null,
        errors: null
      });
    }

    const updates = [];
    const values = [];

    if (nombre !== undefined) {
      updates.push('nombre = ?');
      values.push(nombre);
    }
    if (categoria !== undefined) {
      updates.push('categoria = ?');
      values.push(categoria);
    }
    if (precio !== undefined) {
      updates.push('precio = ?');
      values.push(parseFloat(precio));
    }
    if (stock !== undefined) {
      updates.push('stock = ?');
      values.push(parseInt(stock));
    }
    if (talla !== undefined) {
      updates.push('talla = ?');
      values.push(talla || null);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color || null);
    }
    if (descripcion !== undefined) {
      updates.push('descripcion = ?');
      values.push(descripcion || null);
    }
    if (imagen_url !== undefined) {
      updates.push('imagen_url = ?');
      values.push(imagen_url || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe enviar al menos un campo para actualizar.',
        data: null,
        errors: null
      });
    }

    values.push(id);

    await pool.query(
      `UPDATE gestion_productos SET ${updates.join(', ')} WHERE id_producto = ?`,
      values
    );

    return res.status(200).json({
      success: true,
      message: 'Producto actualizado exitosamente.',
      data: { id_producto: parseInt(id) },
      errors: null
    });

  } catch (error) {
    console.error('Error al editar producto:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al editar producto.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// ACTUALIZAR STOCK
// Actualiza SOLO el campo stock de un producto
const actualizarStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    if (stock === undefined || stock === null || isNaN(stock) || parseInt(stock) < 0) {
      return res.status(400).json({
        success: false,
        message: 'El stock debe ser un número entero mayor o igual a 0.',
        data: null,
        errors: [{ field: 'stock', message: 'Stock inválido' }]
      });
    }

    const [existente] = await pool.query(
      'SELECT id_producto, nombre FROM gestion_productos WHERE id_producto = ?',
      [id]
    );

    if (existente.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado.',
        data: null,
        errors: null
      });
    }

    await pool.query(
      'UPDATE gestion_productos SET stock = ? WHERE id_producto = ?',
      [parseInt(stock), id]
    );

    return res.status(200).json({
      success: true,
      message: `Stock de "${existente[0].nombre}" actualizado a ${parseInt(stock)} unidades.`,
      data: {
        id_producto: parseInt(id),
        nombre: existente[0].nombre,
        nuevo_stock: parseInt(stock)
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al actualizar stock:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al actualizar stock.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// TOGGLE PRODUCTO (activar/desactivar)
// Cambia el estado activo de un producto (0 o 1) como borrado lógico
const toggleProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const [productos] = await pool.query(
      'SELECT id_producto, nombre, activo FROM gestion_productos WHERE id_producto = ?',
      [id]
    );

    if (productos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado.',
        data: null,
        errors: null
      });
    }

    const nuevoEstado = productos[0].activo ? 0 : 1;

    await pool.query(
      'UPDATE gestion_productos SET activo = ? WHERE id_producto = ?',
      [nuevoEstado, id]
    );

    const estadoTexto = nuevoEstado ? 'activado (visible)' : 'desactivado (oculto)';

    return res.status(200).json({
      success: true,
      message: `Producto "${productos[0].nombre}" ${estadoTexto}.`,
      data: {
        id_producto: parseInt(id),
        nombre: productos[0].nombre,
        activo: nuevoEstado
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al toggle producto:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// ELIMINAR PRODUCTO
// Elimina permanentemente un producto de la base de datos (hard delete)
const eliminarProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const [existente] = await pool.query(
      'SELECT id_producto, nombre FROM gestion_productos WHERE id_producto = ?',
      [id]
    );

    if (existente.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado.',
        data: null,
        errors: null
      });
    }

    await pool.query(
      'DELETE FROM gestion_productos WHERE id_producto = ?',
      [id]
    );

    return res.status(200).json({
      success: true,
      message: `Producto "${existente[0].nombre}" eliminado permanentemente.`,
      data: null,
      errors: null
    });

  } catch (error) {
    console.error('Error al eliminar producto:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al eliminar producto.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// LISTAR TODOS LOS USUARIOS
// Devuelve la lista de todos los usuarios registrados sin contraseñas
const listarUsuarios = async (req, res) => {
  try {
    const [usuarios] = await pool.query(
      'SELECT id_usuario, email, nombre, rol_usuario, verificacion_email, fecha_creacion FROM usuarios ORDER BY fecha_creacion DESC'
    );

    return res.status(200).json({
      success: true,
      message: 'Usuarios obtenidos exitosamente.',
      data: {
        usuarios: usuarios,
        total: usuarios.length
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al listar usuarios:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// ELIMINAR USUARIO
// Elimina un usuario del sistema con protección para el admin
const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const adminUserId = req.session.userId;

    if (parseInt(id) === adminUserId) {
      return res.status(400).json({
        success: false,
        message: 'No puede eliminar su propia cuenta de administrador.',
        data: null,
        errors: null
      });
    }

    const [usuarios] = await pool.query(
      'SELECT id_usuario, nombre, email FROM usuarios WHERE id_usuario = ?',
      [id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
        data: null,
        errors: null
      });
    }

    await pool.query(
      'DELETE FROM usuarios WHERE id_usuario = ?',
      [id]
    );

    return res.status(200).json({
      success: true,
      message: `Usuario "${usuarios[0].nombre}" (${usuarios[0].email}) eliminado exitosamente.`,
      data: null,
      errors: null
    });

  } catch (error) {
    console.error('Error al eliminar usuario:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al eliminar usuario.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// LISTAR TODOS LOS PEDIDOS
// Devuelve todos los pedidos del sistema con opción de filtrar por estado
const listarTodosPedidos = async (req, res) => {
  try {
    const { estado } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let countQuery = 'SELECT COUNT(*) AS total FROM pedidos';
    let query = `SELECT 
      p.id_pedido, p.id_usuario, p.fecha_pedido, p.estado, p.total,
      u.nombre AS nombre_usuario, u.email
      FROM pedidos p
      INNER JOIN usuarios u ON p.id_usuario = u.id_usuario`;
    const params = [];

    if (estado && estado.trim()) {
      countQuery += ' WHERE estado = ?';
      query += ' WHERE p.estado = ?';
      params.push(estado.trim());
    }

    const [countResult] = await pool.query(countQuery, params);
    const totalPedidos = countResult[0].total;

    query += ' ORDER BY p.fecha_pedido DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [pedidos] = await pool.query(query, params);
    const totalPaginas = Math.ceil(totalPedidos / limit);

    return res.status(200).json({
      success: true,
      message: 'Pedidos obtenidos exitosamente.',
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
    console.error('Error al listar pedidos (admin):', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// ACTUALIZAR ESTADO DE PEDIDO
// Permite al admin cambiar el estado de un pedido validando transiciones
// FLUJO:
// Validar estado enviado
// Obtener pedido actual
// Validar transiciones permitidas
// Actualizar el estado
const actualizarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado || !estado.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nuevo estado es obligatorio.',
        data: null,
        errors: [{ field: 'estado', message: 'Estado requerido' }]
      });
    }

    const estadosValidos = ['Pendiente', 'Aprobado', 'Rechazado', 'Cancelado', 'Enviado', 'Entregado'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: `Estado inválido. Opciones: ${estadosValidos.join(', ')}`,
        data: null,
        errors: [{ field: 'estado', message: 'Estado no válido' }]
      });
    }

    const [pedidos] = await pool.query(
      'SELECT id_pedido, estado FROM pedidos WHERE id_pedido = ?',
      [id]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado.',
        data: null,
        errors: null
      });
    }

    const estadoActual = pedidos[0].estado;

    const transicionesPermitidas = {
      'Pendiente': ['Aprobado', 'Rechazado', 'Cancelado'],
      'Aprobado': ['Enviado', 'Cancelado'],
      'Enviado': ['Entregado'],
      'Rechazado': [],
      'Cancelado': [],
      'Entregado': []
    };

    const transicionesValidas = transicionesPermitidas[estadoActual] || [];

    if (!transicionesValidas.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: `No se puede cambiar de "${estadoActual}" a "${estado}". Transiciones válidas: ${transicionesValidas.length > 0 ? transicionesValidas.join(', ') : 'ninguna (estado final)'}`,
        data: null,
        errors: null
      });
    }

    await pool.query(
      'UPDATE pedidos SET estado = ? WHERE id_pedido = ?',
      [estado, id]
    );

    return res.status(200).json({
      success: true,
      message: `Estado del pedido #${id} actualizado de "${estadoActual}" a "${estado}".`,
      data: {
        id_pedido: parseInt(id),
        estado_anterior: estadoActual,
        nuevo_estado: estado
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al actualizar estado:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al actualizar estado del pedido.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// LISTAR TODOS LOS TICKETS
// Devuelve todos los tickets del sistema con filtros opcionales
const listarTodosTickets = async (req, res) => {
  try {
    const { estado, tipo } = req.query;

    let query = `SELECT 
      s.id_ticket, s.asunto, s.estado, s.tipo, s.id_pedido,
      s.comentarios, s.respuesta_admin, s.fecha_creacion, s.fecha_actualizacion,
      u.nombre AS nombre_usuario, u.email
      FROM soporte s
      INNER JOIN usuarios u ON s.id_usuario = u.id_usuario
      WHERE 1=1`;
    const params = [];

    if (estado && estado.trim()) {
      query += ' AND s.estado = ?';
      params.push(estado.trim());
    }

    if (tipo && tipo.trim()) {
      query += ' AND s.tipo = ?';
      params.push(tipo.trim());
    }

    query += ' ORDER BY s.fecha_creacion DESC';

    const [tickets] = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      message: 'Tickets obtenidos exitosamente.',
      data: {
        tickets: tickets,
        total: tickets.length,
        filtros: { estado: estado || null, tipo: tipo || null }
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al listar tickets (admin):', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// RESPONDER TICKET
// El admin agrega una respuesta a un ticket de soporte y actualiza estado
// FLUJO:
// Validar respuesta
// Verificar que el ticket exista
// Actualizar ticket con respuesta y estado
const responderTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { respuesta_admin, estado } = req.body;

    if (!respuesta_admin || !respuesta_admin.trim()) {
      return res.status(400).json({
        success: false,
        message: 'La respuesta es obligatoria.',
        data: null,
        errors: [{ field: 'respuesta_admin', message: 'Respuesta requerida' }]
      });
    }

    const [tickets] = await pool.query(
      'SELECT id_ticket, estado FROM soporte WHERE id_ticket = ?',
      [id]
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket no encontrado.',
        data: null,
        errors: null
      });
    }

    const estadosValidos = ['Abierto', 'En Proceso', 'Cerrado'];
    const nuevoEstado = estado && estadosValidos.includes(estado) ? estado : 'En Proceso';

    await pool.query(
      'UPDATE soporte SET respuesta_admin = ?, estado = ? WHERE id_ticket = ?',
      [respuesta_admin.trim(), nuevoEstado, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Ticket respondido exitosamente.',
      data: {
        id_ticket: parseInt(id),
        nuevo_estado: nuevoEstado
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al responder ticket:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al responder ticket.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// PROCESAR REEMBOLSO
// Procesa una solicitud de reembolso asociada a un ticket usando una transacción
// FLUJO:
// Verificar ticket, pedido y pago
// Iniciar transacción
// Actualizar pago a Reembolsado
// Actualizar pedido a Cancelado
// Restaurar stock
// Cerrar el ticket
// Commit
const procesarReembolso = async (req, res) => {
  let connection;

  try {
    const { id } = req.params;
    const { respuesta_admin } = req.body;

    const [tickets] = await pool.query(
      'SELECT id_ticket, id_pedido, tipo, estado FROM soporte WHERE id_ticket = ?',
      [id]
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket no encontrado.',
        data: null,
        errors: null
      });
    }

    const ticket = tickets[0];

    if (ticket.tipo !== 'Reembolso') {
      return res.status(400).json({
        success: false,
        message: 'Este ticket no es de tipo "Reembolso".',
        data: null,
        errors: null
      });
    }

    if (!ticket.id_pedido) {
      return res.status(400).json({
        success: false,
        message: 'Este ticket no tiene un pedido asociado.',
        data: null,
        errors: null
      });
    }

    const [pedidos] = await pool.query(
      'SELECT id_pedido, estado, total FROM pedidos WHERE id_pedido = ?',
      [ticket.id_pedido]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pedido asociado no encontrado.',
        data: null,
        errors: null
      });
    }

    if (pedidos[0].estado === 'Cancelado') {
      return res.status(400).json({
        success: false,
        message: 'El pedido ya está cancelado.',
        data: null,
        errors: null
      });
    }

    const [pagos] = await pool.query(
      'SELECT id_pago, estado FROM pagos WHERE id_pedido = ? AND estado = ?',
      [ticket.id_pedido, 'Aprobado']
    );

    if (pagos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se encontró un pago aprobado para este pedido.',
        data: null,
        errors: null
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(
      'UPDATE pagos SET estado = ? WHERE id_pago = ?',
      ['Reembolsado', pagos[0].id_pago]
    );

    await connection.query(
      'UPDATE pedidos SET estado = ? WHERE id_pedido = ?',
      ['Cancelado', ticket.id_pedido]
    );

    const [detalles] = await connection.query(
      'SELECT id_producto, cantidad FROM detalle_pedido WHERE id_pedido = ?',
      [ticket.id_pedido]
    );

    for (const detalle of detalles) {
      await connection.query(
        'UPDATE gestion_productos SET stock = stock + ? WHERE id_producto = ?',
        [detalle.cantidad, detalle.id_producto]
      );
    }

    const respuesta = respuesta_admin || 'Reembolso procesado exitosamente.';
    await connection.query(
      'UPDATE soporte SET respuesta_admin = ?, estado = ? WHERE id_ticket = ?',
      [respuesta, 'Cerrado', id]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Reembolso procesado exitosamente. Pago reembolsado, pedido cancelado y stock restaurado.',
      data: {
        id_ticket: parseInt(id),
        id_pedido: ticket.id_pedido,
        monto_reembolsado: pedidos[0].total
      },
      errors: null
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Error al procesar reembolso:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al procesar reembolso.',
      data: null,
      errors: [{ message: error.message }]
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
};


// OBTENER ESTADÍSTICAS DEL DASHBOARD
// Devuelve conteos y estadísticas generales ejecutando múltiples consultas en paralelo
const obtenerEstadisticas = async (req, res) => {
  try {
    const [
      [productosResult],
      [productosActivosResult],
      [pedidosResult],
      [pedidosPendientesResult],
      [pedidosAprobadosResult],
      [ticketsResult],
      [ticketsAbiertosResult],
      [usuariosResult],
      [ingresosResult]
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM gestion_productos'),
      pool.query('SELECT COUNT(*) AS total FROM gestion_productos WHERE activo = 1'),
      pool.query('SELECT COUNT(*) AS total FROM pedidos'),
      pool.query('SELECT COUNT(*) AS total FROM pedidos WHERE estado = ?', ['Pendiente']),
      pool.query('SELECT COUNT(*) AS total FROM pedidos WHERE estado = ?', ['Aprobado']),
      pool.query('SELECT COUNT(*) AS total FROM soporte'),
      pool.query('SELECT COUNT(*) AS total FROM soporte WHERE estado = ?', ['Abierto']),
      pool.query('SELECT COUNT(*) AS total FROM usuarios'),
      pool.query(
        'SELECT COALESCE(SUM(total), 0) AS ingresos FROM pedidos WHERE estado IN (?, ?, ?)',
        ['Aprobado', 'Enviado', 'Entregado']
      )
    ]);

    return res.status(200).json({
      success: true,
      message: 'Estadísticas obtenidas exitosamente.',
      data: {
        productos: {
          total: productosResult[0].total,
          activos: productosActivosResult[0].total
        },
        pedidos: {
          total: pedidosResult[0].total,
          pendientes: pedidosPendientesResult[0].total,
          aprobados: pedidosAprobadosResult[0].total
        },
        soporte: {
          total: ticketsResult[0].total,
          abiertos: ticketsAbiertosResult[0].total
        },
        usuarios: {
          total: usuariosResult[0].total
        },
        ingresos: {
          total: parseFloat(ingresosResult[0].ingresos)
        }
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener estadísticas.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// EXPORTAR TODOS LOS CONTROLADORES
module.exports = {
  listarTodosProductos,
  crearProducto,
  editarProducto,
  actualizarStock,
  toggleProducto,
  eliminarProducto,
  listarUsuarios,
  eliminarUsuario,
  listarTodosPedidos,
  actualizarEstado,
  listarTodosTickets,
  responderTicket,
  procesarReembolso,
  obtenerEstadisticas
};
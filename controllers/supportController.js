// Controlador soporte: maneja tickets de ayuda y solicitudes de reembolso.
// Tipos de ticket: Consulta, Reembolso, Problema Técnico, Otro.

const { pool } = require('../config/db');


// CREAR TICKET DE SOPORTE
// Crea un nuevo ticket de soporte para el usuario autenticado
const crearTicket = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { asunto, tipo, comentarios, id_pedido } = req.body;

    if (tipo === 'Reembolso' && id_pedido) {
      const [pedidos] = await pool.query(
        'SELECT id_pedido, estado FROM pedidos WHERE id_pedido = ? AND id_usuario = ?',
        [id_pedido, userId]
      );

      if (pedidos.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado o no le pertenece.',
          data: null,
          errors: [{ field: 'id_pedido', message: 'Pedido no encontrado' }]
        });
      }

      const estadosReembolsables = ['Aprobado', 'Entregado'];
      if (!estadosReembolsables.includes(pedidos[0].estado)) {
        return res.status(400).json({
          success: false,
          message: `No se puede solicitar reembolso para un pedido en estado "${pedidos[0].estado}". Solo pedidos Aprobados o Entregados son elegibles.`,
          data: null,
          errors: null
        });
      }
    }

    const [result] = await pool.query(
      'INSERT INTO soporte (id_usuario, asunto, tipo, id_pedido, comentarios) VALUES (?, ?, ?, ?, ?)',
      [
        userId,
        asunto,
        tipo || 'Consulta',
        id_pedido || null,
        comentarios || null
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Ticket de soporte creado exitosamente. Nuestro equipo lo revisará pronto.',
      data: {
        id_ticket: result.insertId,
        asunto: asunto,
        tipo: tipo || 'Consulta',
        estado: 'Abierto'
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al crear ticket:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al crear ticket de soporte.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// LISTAR TICKETS DEL USUARIO
// Devuelve todos los tickets de soporte del usuario autenticado ordenados por fecha
// SEGURIDAD: Solo muestra tickets del usuario logueado
const listarTickets = async (req, res) => {
  try {
    const userId = req.session.userId;

    const [tickets] = await pool.query(
      `SELECT 
        id_ticket, 
        asunto, 
        estado, 
        tipo, 
        id_pedido, 
        comentarios, 
        respuesta_admin, 
        fecha_creacion, 
        fecha_actualizacion
       FROM soporte 
       WHERE id_usuario = ? 
       ORDER BY fecha_creacion DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: tickets.length > 0 ? 'Tickets obtenidos exitosamente.' : 'No tiene tickets de soporte.',
      data: {
        tickets: tickets,
        total: tickets.length
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al listar tickets:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener tickets.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// OBTENER DETALLE DE UN TICKET
// Devuelve la información completa de un ticket específico incluyendo respuesta del admin
// SEGURIDAD: Verificamos que el ticket pertenezca al usuario
const obtenerTicket = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;

    const [tickets] = await pool.query(
      `SELECT 
        id_ticket, 
        asunto, 
        estado, 
        tipo, 
        id_pedido, 
        comentarios, 
        respuesta_admin, 
        fecha_creacion, 
        fecha_actualizacion
       FROM soporte 
       WHERE id_ticket = ? AND id_usuario = ?`,
      [id, userId]
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket no encontrado.',
        data: null,
        errors: null
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ticket obtenido exitosamente.',
      data: tickets[0],
      errors: null
    });

  } catch (error) {
    console.error('Error al obtener ticket:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener ticket.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// Exportar controladores
module.exports = {
  crearTicket,
  listarTickets,
  obtenerTicket
};
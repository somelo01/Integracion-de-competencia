// Rutas de soporte montadas en /api/soporte.
// Todas requieren sesión activa.

const express = require('express');
const router = express.Router();

// Importar controlador y middlewares
const supportController = require('../controllers/supportController');
const { isAuthenticated } = require('../middleware/auth');
const { validateTicket, validateId } = require('../middleware/validators');

// Rutas protegidas de soporte

// --- CREAR TICKET DE SOPORTE ---
// POST /api/soporte/crear
// Body: { asunto, tipo, comentarios, id_pedido? }
// validateTicket valida asunto y tipo, verifica id_pedido si es Reembolso
router.post('/crear', isAuthenticated, validateTicket, supportController.crearTicket);

// --- LISTAR TICKETS DEL USUARIO ---
// GET /api/soporte
// Devuelve todos los tickets del usuario autenticado
router.get('/', isAuthenticated, supportController.listarTickets);

// --- OBTENER DETALLE DE UN TICKET ---
// GET /api/soporte/5
// Devuelve información completa incluyendo respuesta_admin
// validateId verifica que :id sea un entero positivo
router.get('/:id', isAuthenticated, validateId, supportController.obtenerTicket);

// Exportar router
module.exports = router;

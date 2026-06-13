// ============================================================
// RUTAS: SOPORTE (supportRoutes.js)
// ============================================================
// Define las rutas para el sistema de tickets de soporte.
// TODAS las rutas requieren autenticación (isAuthenticated).
//
// RELACIÓN CON OTROS ARCHIVOS:
//   - controllers/supportController.js → Lógica de cada operación
//   - middleware/auth.js → isAuthenticated protege todas las rutas
//   - middleware/validators.js → validateTicket valida al crear
//   - app.js → Monta este router en /api/soporte
//
// CORRESPONDENCIA CON DIAGRAMAS:
//   - Casos de Uso del Cliente (imagen 2): "Solicitar Soporte",
//     "Ver Tickets", "Solicitar Reembolso"
//   - ERD (imagen 4): Tabla "soporte"
//   - Diagrama de Secuencia: Devolución/Reembolso (imagen 6)
//
// NOTA: Las rutas de administración de tickets (responder,
// procesar reembolso) están en routes/adminRoutes.js porque
// requieren permisos de admin.
// ============================================================

const express = require('express');
const router = express.Router();

// Importar controlador y middlewares
const supportController = require('../controllers/supportController');
const { isAuthenticated } = require('../middleware/auth');
const { validateTicket, validateId } = require('../middleware/validators');

// ============================================================
// RUTAS (todas requieren autenticación)
// ============================================================

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

// ============================================================
// EXPORTAR ROUTER
// ============================================================
module.exports = router;

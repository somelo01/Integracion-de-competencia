// ============================================================
// RUTAS: PEDIDOS (orderRoutes.js)
// ============================================================
// Define las rutas para la gestión de pedidos del cliente.
// TODAS las rutas requieren autenticación (isAuthenticated).
//
// RELACIÓN CON OTROS ARCHIVOS:
//   - controllers/orderController.js → Lógica de cada operación
//   - middleware/auth.js → isAuthenticated protege todas las rutas
//   - middleware/validators.js → validateId para parámetro :id
//   - app.js → Monta este router en /api/pedidos
//
// CORRESPONDENCIA CON DIAGRAMAS:
//   - Casos de Uso del Cliente (imagen 2): "Realizar Compra",
//     "Ver Historial de Pedidos", "Cancelar Pedido"
//   - Diagrama de Secuencia (imagen 5): Proceso de compra completo
//   - Diagrama de Estados (imagen 3): Transiciones de estado del pedido
// ============================================================

const express = require('express');
const router = express.Router();

// Importar controlador y middlewares
const orderController = require('../controllers/orderController');
const { isAuthenticated } = require('../middleware/auth');
const { validateId } = require('../middleware/validators');

// ============================================================
// RUTAS (todas requieren autenticación)
// ============================================================

// --- CREAR PEDIDO (desde el carrito) ---
// POST /api/pedidos/crear
// Convierte el carrito en un pedido formal
// Usa transacción MySQL para garantizar consistencia
router.post('/crear', isAuthenticated, orderController.crearPedido);

// --- LISTAR PEDIDOS DEL USUARIO ---
// GET /api/pedidos?page=1&limit=10
// Historial de pedidos con paginación
router.get('/', isAuthenticated, orderController.listarPedidos);

// --- OBTENER DETALLE DE UN PEDIDO ---
// GET /api/pedidos/42
// Devuelve pedido con todos sus productos
// validateId verifica que :id sea un entero positivo
router.get('/:id', isAuthenticated, validateId, orderController.obtenerPedido);

// --- CANCELAR PEDIDO ---
// PUT /api/pedidos/42/cancelar
// Solo si el pedido está en estado 'Pendiente'
// Restaura el stock de los productos
router.put('/:id/cancelar', isAuthenticated, validateId, orderController.cancelarPedido);

// ============================================================
// EXPORTAR ROUTER
// ============================================================
module.exports = router;

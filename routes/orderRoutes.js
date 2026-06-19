// Rutas de pedidos montadas en /api/pedidos.
// Todas requieren sesión activa.

const express = require('express');
const router = express.Router();

// Importar controlador y middlewares
const orderController = require('../controllers/orderController');
const { isAuthenticated } = require('../middleware/auth');
const { validateId } = require('../middleware/validators');

// Rutas de pedido protegidas por isAuthenticated.

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

// Exportar router
module.exports = router;

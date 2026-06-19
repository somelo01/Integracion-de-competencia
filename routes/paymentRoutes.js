// Rutas de pago Webpay montadas en /api/pagos.
// /crear y /:id requieren sesión; /confirmar es callback GET.

const express = require('express');
const router = express.Router();

// Importar controlador y middleware
const paymentController = require('../controllers/paymentController');
const { isAuthenticated } = require('../middleware/auth');

// Rutas de pago

// --- CREAR TRANSACCIÓN DE PAGO ---
// POST /api/pagos/crear
// Body: { id_pedido }
// Requiere autenticación (el usuario debe estar logueado)
// Devuelve la URL de Webpay para redirigir
router.post('/crear', isAuthenticated, paymentController.crearTransaccion);

// --- CONFIRMAR PAGO (callback de Webpay) ---
// GET /api/pagos/confirmar?token_ws=XXXXX
// NO requiere autenticación → es un redirect del navegador desde Webpay
// La sesión puede no estar disponible en este contexto de redirect
// Procesa el resultado y redirige a página de éxito/error
router.get('/confirmar', paymentController.confirmarPago);

// --- OBTENER INFORMACIÓN DE PAGO ---
// GET /api/pagos/42 (donde 42 es el id_pedido)
// Requiere autenticación
// Devuelve estado del pago y factura si existe
router.get('/:idPedido', isAuthenticated, paymentController.obtenerPago);

// Exportar router
module.exports = router;

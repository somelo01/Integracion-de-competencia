// ============================================================
// RUTAS: PAGOS (paymentRoutes.js)
// ============================================================
// Define las rutas para la integración con Webpay Plus.
// El flujo de pago involucra redirecciones del navegador,
// por eso la ruta /confirmar es GET (no POST).
//
// RELACIÓN CON OTROS ARCHIVOS:
//   - controllers/paymentController.js → Lógica de Webpay
//   - middleware/auth.js → crearTransaccion y obtenerPago necesitan sesión
//   - app.js → Monta este router en /api/pagos
//
// CORRESPONDENCIA CON DIAGRAMAS:
//   - Diagrama de Secuencia: Proceso de Compra (imagen 5):
//     Muestra las interacciones entre Cliente, Backend y Webpay
//   - ERD (imagen 4): Tablas "pagos" y "facturas"
//   - Diagrama de Estados (imagen 3): Estados del pago
//
// FLUJO COMPLETO DE PAGO:
//   1. Frontend: POST /api/pagos/crear → recibe url + token
//   2. Frontend: Redirige usuario a url de Webpay
//   3. Usuario: Paga en formulario de Webpay
//   4. Webpay: Redirige a GET /api/pagos/confirmar?token_ws=XXX
//   5. Backend: Confirma con tx.commit() y redirige a HTML
// ============================================================

const express = require('express');
const router = express.Router();

// Importar controlador y middleware
const paymentController = require('../controllers/paymentController');
const { isAuthenticated } = require('../middleware/auth');

// ============================================================
// RUTAS
// ============================================================

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

// ============================================================
// EXPORTAR ROUTER
// ============================================================
module.exports = router;

// ============================================================
// RUTAS: CARRITO DE COMPRAS (cartRoutes.js)
// ============================================================
// Define las rutas para la gestión del carrito de compras.
// TODAS las rutas requieren autenticación (isAuthenticated)
// porque el carrito pertenece a un usuario específico.
//
// RELACIÓN CON OTROS ARCHIVOS:
//   - controllers/cartController.js → Lógica de cada operación
//   - middleware/auth.js → isAuthenticated protege todas las rutas
//   - middleware/validators.js → validateCartItem valida al agregar
//   - app.js → Monta este router en /api/carrito
//
// CORRESPONDENCIA CON DIAGRAMAS:
//   - Casos de Uso del Cliente (imagen 2): "Agregar al Carrito",
//     "Ver Carrito", "Modificar Cantidad", "Eliminar del Carrito"
//   - ERD (imagen 4): Tablas "carrito_compras" y "detalle_carrito"
//   - Diagrama de Secuencia (imagen 5): Paso previo a crear pedido
// ============================================================

const express = require('express');
const router = express.Router();

// Importar controlador y middlewares
const cartController = require('../controllers/cartController');
const { isAuthenticated } = require('../middleware/auth');
const { validateCartItem } = require('../middleware/validators');

// ============================================================
// TODAS LAS RUTAS REQUIEREN AUTENTICACIÓN
// ============================================================

// --- VER CONTENIDO DEL CARRITO ---
// GET /api/carrito
// Devuelve items con nombres, precios, subtotales y total
router.get('/', isAuthenticated, cartController.verCarrito);

// --- AGREGAR PRODUCTO AL CARRITO ---
// POST /api/carrito/agregar
// Body: { id_producto, cantidad }
// validateCartItem verifica que ambos campos sean válidos
router.post('/agregar', isAuthenticated, validateCartItem, cartController.agregarItem);

// --- ACTUALIZAR CANTIDAD DE UN ITEM ---
// PUT /api/carrito/actualizar/5
// Body: { cantidad }
// :idDetalle es el id_detalle_carrito del item específico
router.put('/actualizar/:idDetalle', isAuthenticated, cartController.actualizarCantidad);

// --- ELIMINAR UN ITEM DEL CARRITO ---
// DELETE /api/carrito/eliminar/5
// :idDetalle es el id_detalle_carrito del item a eliminar
router.delete('/eliminar/:idDetalle', isAuthenticated, cartController.eliminarItem);

// --- VACIAR TODO EL CARRITO ---
// DELETE /api/carrito/vaciar
// Elimina todos los items del carrito
router.delete('/vaciar', isAuthenticated, cartController.vaciarCarrito);

// ============================================================
// EXPORTAR ROUTER
// ============================================================
module.exports = router;

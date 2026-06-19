// Rutas de carrito montadas en /api/carrito.
// Todas requieren sesión activa.

const express = require('express');
const router = express.Router();

// Importar controlador y middlewares
const cartController = require('../controllers/cartController');
const { isAuthenticated } = require('../middleware/auth');
const { validateCartItem } = require('../middleware/validators');

// Rutas protegidas de carrito

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

// Exportar router
module.exports = router;

// Rutas públicas de productos montadas en /api/productos.
// No requieren autenticación.

const express = require('express');
const router = express.Router();

// Importar el controlador de productos
const productController = require('../controllers/productController');

// Importar validador de ID para rutas con parámetro :id
const { validateId } = require('../middleware/validators');

// Rutas públicas de productos

// --- LISTAR TODOS LOS PRODUCTOS (paginados) ---
// GET /api/productos?page=1&limit=12
// Devuelve productos activos con paginación
router.get('/', productController.listarProductos);

// --- BUSCAR PRODUCTOS POR TEXTO ---
// GET /api/productos/buscar?q=camiseta
// Busca en nombre y descripción con LIKE
router.get('/buscar', productController.buscarProductos);

// --- FILTRAR PRODUCTOS ---
// GET /api/productos/filtrar?categoria=Camisetas&precio_min=5000&precio_max=20000&talla=M&color=Negro
// Filtra por múltiples criterios opcionales
router.get('/filtrar', productController.filtrarProductos);

// --- LISTAR CATEGORÍAS ---
// GET /api/productos/categorias
// Devuelve las categorías únicas disponibles
router.get('/categorias', productController.listarCategorias);

// --- OBTENER PRODUCTO POR ID ---
// GET /api/productos/42
// Devuelve los detalles completos de un producto
// validateId verifica que :id sea un entero positivo
router.get('/:id', validateId, productController.obtenerProducto);

// Exportar router
module.exports = router;

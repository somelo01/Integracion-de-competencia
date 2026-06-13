// ============================================================
// RUTAS: PRODUCTOS (productRoutes.js)
// ============================================================
// Define las rutas PÚBLICAS del catálogo de productos.
// Estas rutas NO requieren autenticación porque cualquier
// visitante (incluso sin cuenta) puede explorar el catálogo.
//
// RELACIÓN CON OTROS ARCHIVOS:
//   - controllers/productController.js → Lógica de cada endpoint
//   - middleware/validators.js → validateId para validar parámetro :id
//   - app.js → Monta este router en /api/productos
//
// CORRESPONDENCIA CON DIAGRAMAS:
//   - Casos de Uso del Cliente (imagen 2): "Buscar Productos",
//     "Filtrar por Categoría/Precio", "Ver Detalle de Producto"
//   - ERD (imagen 4): Tabla "gestion_productos"
//
// IMPORTANTE SOBRE EL ORDEN DE LAS RUTAS:
//   Las rutas específicas (/buscar, /filtrar, /categorias) deben
//   ir ANTES de la ruta con parámetro (/:id). Si /:id va primero,
//   Express interpretaría "buscar" como un ID y nunca llegaría a
//   la ruta /buscar.
//
//   Correcto: /buscar → /filtrar → /categorias → /:id
//   Incorrecto: /:id → /buscar (nunca llega aquí)
// ============================================================

const express = require('express');
const router = express.Router();

// Importar el controlador de productos
const productController = require('../controllers/productController');

// Importar validador de ID para rutas con parámetro :id
const { validateId } = require('../middleware/validators');

// ============================================================
// RUTAS PÚBLICAS (sin autenticación)
// ============================================================

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

// ============================================================
// EXPORTAR ROUTER
// ============================================================
module.exports = router;

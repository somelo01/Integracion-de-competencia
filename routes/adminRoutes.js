// ============================================================
// RUTAS: ADMINISTRACIÓN (adminRoutes.js)
// ============================================================
// Define TODAS las rutas del panel de administración.
// Cada ruta pasa por DOS middlewares de seguridad:
//   1. isAuthenticated → ¿El usuario tiene sesión activa?
//   2. isAdmin → ¿El usuario tiene rol 'Admin'?
//
// RELACIÓN CON OTROS ARCHIVOS:
//   - controllers/adminController.js → Lógica de cada operación
//   - middleware/auth.js → isAuthenticated (primer filtro)
//   - middleware/adminAuth.js → isAdmin (segundo filtro)
//   - middleware/validators.js → validateProduct y validateId
//   - app.js → Monta este router en /api/admin
//
// CORRESPONDENCIA CON DIAGRAMAS:
//   - Casos de Uso del Admin (imagen 2): TODOS los casos del
//     lado derecho: Gestionar Productos, Usuarios, Pedidos,
//     Soporte y Dashboard
//   - ERD (imagen 4): Acceso completo a todas las tablas
//   - Diagrama de Estados (imagen 3): Transiciones de pedidos
//   - Diagrama de Secuencia: Devolución/Reembolso (imagen 6)
//
// ORGANIZACIÓN DE RUTAS:
//   Las rutas están agrupadas por sección (Productos, Usuarios,
//   Pedidos, Soporte, Dashboard) para facilitar la lectura.
// ============================================================

const express = require('express');
const router = express.Router();

// Importar controlador y middlewares
const adminController = require('../controllers/adminController');
const { isAuthenticated } = require('../middleware/auth');
const { isAdmin } = require('../middleware/adminAuth');
const { validateProduct, validateId } = require('../middleware/validators');

// ============================================================
// MIDDLEWARE GLOBAL DEL ROUTER
// ============================================================
// router.use() aplica estos middlewares a TODAS las rutas
// definidas en este router. Así no hay que repetirlos en cada
// ruta individual.
//
// CADENA: isAuthenticated → isAdmin → controlador
// Si isAuthenticated falla → 401 (no logueado)
// Si isAdmin falla → 403 (no es admin)
// ============================================================
router.use(isAuthenticated, isAdmin);

// ============================================================
// =================== PRODUCTOS ==============================
// ============================================================

// --- LISTAR TODOS LOS PRODUCTOS (incluyendo inactivos) ---
// GET /api/admin/productos?page=1&limit=20
router.get('/productos', adminController.listarTodosProductos);

// --- CREAR PRODUCTO ---
// POST /api/admin/productos
// Body: { nombre, categoria, precio, stock, talla?, color?, descripcion?, imagen_url? }
// validateProduct verifica campos obligatorios y formatos
router.post('/productos', validateProduct, adminController.crearProducto);

// --- EDITAR PRODUCTO ---
// PUT /api/admin/productos/42
// Body: campos a actualizar (solo los que cambien)
router.put('/productos/:id', validateId, adminController.editarProducto);

// --- ACTUALIZAR SOLO STOCK ---
// PUT /api/admin/productos/42/stock
// Body: { stock: 100 }
router.put('/productos/:id/stock', validateId, adminController.actualizarStock);

// --- ACTIVAR/DESACTIVAR PRODUCTO ---
// PUT /api/admin/productos/42/toggle
// Invierte el campo 'activo' (0↔1) - soft delete
router.put('/productos/:id/toggle', validateId, adminController.toggleProducto);

// --- ELIMINAR PRODUCTO (permanente) ---
// DELETE /api/admin/productos/42
// ADVERTENCIA: Eliminación permanente (hard delete)
router.delete('/productos/:id', validateId, adminController.eliminarProducto);

// ============================================================
// =================== USUARIOS ===============================
// ============================================================

// --- LISTAR TODOS LOS USUARIOS ---
// GET /api/admin/usuarios
router.get('/usuarios', adminController.listarUsuarios);

// --- ELIMINAR USUARIO ---
// DELETE /api/admin/usuarios/42
// No puede eliminarse a sí mismo
router.delete('/usuarios/:id', validateId, adminController.eliminarUsuario);

// ============================================================
// =================== PEDIDOS ================================
// ============================================================

// --- LISTAR TODOS LOS PEDIDOS ---
// GET /api/admin/pedidos?estado=Pendiente&page=1&limit=20
// Filtro opcional por estado
router.get('/pedidos', adminController.listarTodosPedidos);

// --- ACTUALIZAR ESTADO DE PEDIDO ---
// PUT /api/admin/pedidos/42/estado
// Body: { estado: "Enviado" }
// Valida transiciones permitidas según diagrama de estados
router.put('/pedidos/:id/estado', validateId, adminController.actualizarEstado);

// ============================================================
// =================== SOPORTE ================================
// ============================================================

// --- LISTAR TODOS LOS TICKETS ---
// GET /api/admin/soporte?estado=Abierto&tipo=Reembolso
// Filtros opcionales por estado y tipo
router.get('/soporte', adminController.listarTodosTickets);

// --- RESPONDER TICKET ---
// PUT /api/admin/soporte/5/responder
// Body: { respuesta_admin: "Texto de respuesta", estado?: "Cerrado" }
router.put('/soporte/:id/responder', validateId, adminController.responderTicket);

// --- PROCESAR REEMBOLSO ---
// PUT /api/admin/soporte/5/reembolso
// Body: { respuesta_admin?: "Reembolso aprobado" }
// Actualiza pago, pedido, stock y cierra el ticket
router.put('/soporte/:id/reembolso', validateId, adminController.procesarReembolso);

// ============================================================
// =================== DASHBOARD ==============================
// ============================================================

// --- OBTENER ESTADÍSTICAS ---
// GET /api/admin/dashboard
// Devuelve conteos de productos, pedidos, tickets, usuarios e ingresos
router.get('/dashboard', adminController.obtenerEstadisticas);

// ============================================================
// EXPORTAR ROUTER
// ============================================================
module.exports = router;

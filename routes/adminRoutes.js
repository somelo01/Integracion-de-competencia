// Rutas de administración montadas en /api/admin.
// Aplica isAuthenticated e isAdmin a todo el router.

const express = require('express');
const router = express.Router();

// Importar controlador y middlewares
const adminController = require('../controllers/adminController');
const { isAuthenticated } = require('../middleware/auth');
const { isAdmin } = require('../middleware/adminAuth');
const { validateProduct, validateId } = require('../middleware/validators');

// Aplicar autenticación y comprobación de admin a todo el router.
router.use(isAuthenticated, isAdmin);

// Productos

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

// Usuarios

// --- LISTAR TODOS LOS USUARIOS ---
// GET /api/admin/usuarios
router.get('/usuarios', adminController.listarUsuarios);

// --- ELIMINAR USUARIO ---
// DELETE /api/admin/usuarios/42
// No puede eliminarse a sí mismo
router.delete('/usuarios/:id', validateId, adminController.eliminarUsuario);

// Pedidos

// --- LISTAR TODOS LOS PEDIDOS ---
// GET /api/admin/pedidos?estado=Pendiente&page=1&limit=20
// Filtro opcional por estado
router.get('/pedidos', adminController.listarTodosPedidos);

// --- ACTUALIZAR ESTADO DE PEDIDO ---
// PUT /api/admin/pedidos/42/estado
// Body: { estado: "Enviado" }
// Valida transiciones permitidas según diagrama de estados
router.put('/pedidos/:id/estado', validateId, adminController.actualizarEstado);

// Soporte

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

// Dashboard

// --- OBTENER ESTADÍSTICAS ---
// GET /api/admin/dashboard
// Devuelve conteos de productos, pedidos, tickets, usuarios e ingresos
router.get('/dashboard', adminController.obtenerEstadisticas);

// Exportar router
module.exports = router;

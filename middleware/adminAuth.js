// ============================================================
// MIDDLEWARE: AUTORIZACIÓN DE ADMINISTRADOR
// ============================================================
// Verifica que el usuario logueado tenga el rol 'Admin'.
// Se usa DESPUÉS de isAuthenticated en las rutas del panel admin.
//
// CADENA DE MIDDLEWARE EN RUTAS ADMIN:
//   router.get('/admin/productos', isAuthenticated, isAdmin, adminController.listarProductos);
//   1. isAuthenticated → ¿Está logueado? Si no → 401
//   2. isAdmin → ¿Es admin? Si no → 403
//   3. adminController.listarProductos → Ejecutar la lógica
//
// DIFERENCIA ENTRE 401 Y 403:
//   401 (Unauthorized) = No se ha identificado (no hay sesión)
//   403 (Forbidden) = Se identificó pero NO tiene permiso
//
// RELACIÓN CON OTROS ARCHIVOS:
//   - middleware/auth.js → Se usa antes de este middleware
//   - controllers/authController.js → Establece req.session.rol en login
//   - routes/adminRoutes.js → Usa ambos middlewares en todas sus rutas
// ============================================================

function isAdmin(req, res, next) {
  // Verificar que el rol en la sesión sea 'Admin'
  // (se establece en authController.login)
  if (req.session && req.session.rol === 'Admin') {
    return next();
  }

  // No es admin → responder con 403 (prohibido)
  return res.status(403).json({
    success: false,
    message: 'Acceso denegado. Se requieren permisos de administrador.',
    data: null,
    errors: null
  });
}

module.exports = { isAdmin };

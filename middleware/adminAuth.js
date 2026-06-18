// Middleware isAdmin: permite acceso solo a usuarios con rol Admin.
// Se debe aplicar después de isAuthenticated en rutas admin.

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

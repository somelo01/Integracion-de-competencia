// Middleware isAuthenticated: requiere sesión activa de usuario.
// Si no hay sesión válida, responde 401 y detiene la ruta.

function isAuthenticated(req, res, next) {
  // Verificar si existe el userId en la sesión
  // (se establece en authController.login cuando el login es exitoso)
  if (req.session && req.session.userId) {
    // El usuario está autenticado → continuar a la siguiente función
    return next();
  }

  // No está autenticado → responder con 401
  return res.status(401).json({
    success: false,
    message: 'No autorizado. Debe iniciar sesión para acceder a este recurso.',
    data: null,
    errors: null
  });
}

module.exports = { isAuthenticated };

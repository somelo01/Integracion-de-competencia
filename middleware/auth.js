// ============================================================
// MIDDLEWARE: AUTENTICACIÓN DE USUARIO
// ============================================================
// Verifica que el usuario tenga una sesión activa (esté logueado).
// Se usa como "guardia" en las rutas que requieren estar autenticado.
//
// ¿CÓMO FUNCIONA?
// Cuando un usuario hace login exitoso, guardamos sus datos en
// la sesión (req.session.userId, req.session.rol). Este middleware
// verifica que esos datos existan. Si no existen, significa que
// el usuario no ha hecho login o su sesión expiró.
//
// USO EN LAS RUTAS:
//   const { isAuthenticated } = require('../middleware/auth');
//   router.get('/carrito', isAuthenticated, cartController.verCarrito);
//   // Si el usuario NO está logueado → responde 401 (no autorizado)
//   // Si el usuario SÍ está logueado → ejecuta cartController.verCarrito
//
// RELACIÓN CON OTROS ARCHIVOS:
//   - controllers/authController.js → Establece req.session.userId en login
//   - config/db.js → Las sesiones se persisten en MySQL (express-mysql-session)
//   - app.js → Configura express-session con el session store
// ============================================================

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

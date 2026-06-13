// ============================================================
// RUTAS: AUTENTICACIÓN (authRoutes.js)
// ============================================================
// Define las rutas (endpoints) para el módulo de autenticación.
// Cada ruta conecta una URL + método HTTP con un controlador.
//
// ¿QUÉ ES UN ROUTER?
// Un Router de Express es como un "mini-app" que agrupa rutas
// relacionadas. En app.js se monta con:
//   app.use('/api/auth', authRoutes);
// Entonces POST /registro aquí → POST /api/auth/registro completo.
//
// FLUJO DE UNA PETICIÓN:
//   URL + Método → Middleware(s) → Controlador
//   POST /api/auth/registro → validateRegister → authController.registrar
//
// RELACIÓN CON OTROS ARCHIVOS:
//   - controllers/authController.js → Contiene la lógica de cada función
//   - middleware/validators.js → Validaciones que se ejecutan antes del controlador
//   - middleware/auth.js → Protege rutas que requieren sesión activa
//   - app.js → Monta este router en /api/auth
//
// CORRESPONDENCIA CON DIAGRAMAS:
//   - Casos de Uso del Cliente (imagen 2):
//     "Registrarse", "Iniciar Sesión", "Cerrar Sesión",
//     "Recuperar Contraseña"
//   - Diagrama de Secuencia (imagen 5): Flujo de autenticación
// ============================================================

const express = require('express');
const router = express.Router();

// Importar el controlador con todas las funciones de autenticación
const authController = require('../controllers/authController');

// Importar middlewares necesarios
const { isAuthenticated } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validators');

// ============================================================
// DEFINICIÓN DE RUTAS
// ============================================================
// Cada ruta usa router.MÉTODO(ruta, [middlewares], controlador)
//
// IMPORTANTE SOBRE EL ORDEN DE MIDDLEWARES:
// Se ejecutan de izquierda a derecha. Si el middleware rechaza
// la petición (ej: validación falla), el controlador NUNCA se ejecuta.
// ============================================================

// --- REGISTRO ---
// POST /api/auth/registro
// Body: { email, nombre, contrasena }
// Middleware: validateRegister verifica formato de email, nombre y contraseña
// Controlador: registrar crea el usuario y su carrito
router.post('/registro', validateRegister, authController.registrar);

// --- LOGIN ---
// POST /api/auth/login
// Body: { email, contrasena }
// Middleware: validateLogin verifica que email y contraseña existan
// Controlador: login verifica credenciales y crea la sesión
router.post('/login', validateLogin, authController.login);

// --- LOGOUT ---
// POST /api/auth/logout
// Middleware: isAuthenticated verifica que haya sesión activa
// (No tiene sentido hacer logout si no estás logueado)
// Controlador: logout destruye la sesión
router.post('/logout', isAuthenticated, authController.logout);

// --- OBTENER PERFIL ---
// GET /api/auth/perfil
// Middleware: isAuthenticated (solo usuarios logueados)
// Controlador: obtenerPerfil devuelve datos del usuario actual
router.get('/perfil', isAuthenticated, authController.obtenerPerfil);

// --- EDITAR PERFIL ---
// PUT /api/auth/perfil
// Body: { nombre?, contrasena? } (al menos uno)
// Middleware: isAuthenticated (solo usuarios logueados)
// Controlador: editarPerfil actualiza nombre y/o contraseña
router.put('/perfil', isAuthenticated, authController.editarPerfil);

// --- SOLICITAR RECUPERACIÓN DE CONTRASEÑA ---
// POST /api/auth/recuperar
// Body: { email }
// SIN middleware de autenticación (el usuario no puede loguearse)
// Controlador: solicitarRecuperacion genera token y lo guarda
router.post('/recuperar', authController.solicitarRecuperacion);

// --- RESTABLECER CONTRASEÑA ---
// POST /api/auth/reset/:token
// Params: token (de la URL)
// Body: { contrasena }
// SIN middleware de autenticación (el usuario usa el token en vez de sesión)
// Controlador: restablecerContrasena valida token y actualiza contraseña
router.post('/reset/:token', authController.restablecerContrasena);

// --- VERIFICAR SESIÓN ---
// GET /api/auth/session
// SIN middleware de autenticación (justamente verifica si hay sesión)
// Controlador: verificarSesion devuelve datos de sesión o null
// USADO POR: El frontend al cargar cada página (auth.js del frontend)
router.get('/session', authController.verificarSesion);

// ============================================================
// EXPORTAR EL ROUTER
// ============================================================
// app.js importa este módulo y lo monta en /api/auth
// ============================================================
module.exports = router;

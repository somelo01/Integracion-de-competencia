// ============================================================
// ARCHIVO PRINCIPAL: app.js
// ============================================================
// Este es el PUNTO DE ENTRADA del servidor. Aquí se configura
// Express, las sesiones, las rutas y se arranca el servidor.
//
// ANALOGÍA: Este archivo es como el "director de orquesta" que
// coordina todos los componentes del sistema. Cada músico
// (ruta, middleware, controlador) sabe tocar su parte, pero
// el director es quien los organiza.
//
// FLUJO DE UNA PETICIÓN HTTP:
//   1. El navegador envía una petición (ej: GET /api/productos)
//   2. Express la recibe aquí en app.js
//   3. Pasa por los middlewares globales (json, session, etc.)
//   4. Se enruta al archivo de rutas correspondiente (productRoutes.js)
//   5. La ruta llama al middleware de validación si aplica
//   6. Luego llama al controlador que ejecuta la lógica
//   7. El controlador responde al navegador con JSON
//
// RELACIÓN CON OTROS ARCHIVOS:
//   - config/db.js → Pool de conexiones MySQL y testConnection()
//   - routes/*.js → Definiciones de rutas para cada módulo
//   - middleware/*.js → Autenticación, validaciones
//   - public/ → Archivos estáticos del frontend (HTML, CSS, JS)
//
// INSPIRADO EN: Diagrama de Arquitectura del sistema (imagen 1)
// que muestra la separación Frontend ↔ Backend ↔ Base de Datos.
// ============================================================

// ============================================================
// 1. CARGA DE VARIABLES DE ENTORNO
// ============================================================
// dotenv lee el archivo .env y carga sus valores en process.env.
// DEBE ser lo primero que se ejecuta para que las demás líneas
// puedan acceder a las variables (DB_HOST, SESSION_SECRET, etc.)
// ============================================================
require('dotenv').config();

// ============================================================
// 2. IMPORTACIONES
// ============================================================
const express = require('express');                   // Framework web principal
const session = require('express-session');           // Manejo de sesiones de usuario
const MySQLStore = require('express-mysql-session')(session); // Almacenar sesiones en MySQL
const path = require('path');                         // Utilidad para manejar rutas de archivos
const { pool, testConnection } = require('./config/db'); // Pool MySQL y función de prueba

// ============================================================
// Importar todos los archivos de RUTAS
// ============================================================
// Cada archivo de rutas agrupa los endpoints de un módulo.
// Esto sigue el patrón MVC (Model-View-Controller) y mantiene
// el código organizado y mantenible.
// ============================================================
const authRoutes = require('./routes/authRoutes');         // Autenticación (registro, login, logout)
const productRoutes = require('./routes/productRoutes');   // Catálogo de productos (público)
const cartRoutes = require('./routes/cartRoutes');         // Carrito de compras (requiere sesión)
const orderRoutes = require('./routes/orderRoutes');       // Pedidos (requiere sesión)
const paymentRoutes = require('./routes/paymentRoutes');   // Pagos con Webpay (transbank-sdk)
const supportRoutes = require('./routes/supportRoutes');   // Soporte / tickets (requiere sesión)
const adminRoutes = require('./routes/adminRoutes');       // Panel de administración (requiere Admin)

// ============================================================
// 3. CREAR LA APLICACIÓN EXPRESS
// ============================================================
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// 4. MIDDLEWARES GLOBALES
// ============================================================
// Estos middlewares se ejecutan en CADA petición, antes de que
// llegue a cualquier ruta. El orden importa.
// ============================================================

// --- 4.1 Parsear JSON ---
// Permite que req.body contenga los datos JSON enviados por
// el frontend (ej: fetch con Content-Type: application/json).
// Sin esto, req.body sería undefined.
app.use(express.json());

// --- 4.2 Parsear formularios URL-encoded ---
// Permite que req.body contenga datos de formularios HTML
// tradicionales (Content-Type: application/x-www-form-urlencoded).
// extended: true permite objetos anidados.
app.use(express.urlencoded({ extended: true }));

// ============================================================
// 5. CONFIGURACIÓN DEL SESSION STORE (MySQL)
// ============================================================
// Por defecto, express-session guarda las sesiones en memoria
// del servidor (RAM). Esto tiene DOS problemas:
//   1. Se pierden al reiniciar el servidor
//   2. No escalan si hay múltiples servidores
//
// Solución: Guardar las sesiones en MySQL usando express-mysql-session.
// Esto crea automáticamente una tabla 'sessions' en la BD.
//
// ¿CÓMO FUNCIONA?
//   1. Usuario hace login → se crea un registro en tabla 'sessions'
//   2. Se envía una cookie (connect.sid) al navegador
//   3. En cada petición, la cookie identifica al usuario
//   4. Express recupera los datos de sesión desde MySQL
//
// RELACIÓN CON:
//   - config/db.js → Se usa el mismo pool de conexiones
//   - middleware/auth.js → Verifica req.session.userId
//   - controllers/authController.js → Establece datos en la sesión
// ============================================================

// Opciones para el almacén de sesiones en MySQL
const sessionStoreOptions = {
  // Reutilizar el pool existente de config/db.js en vez de crear
  // una nueva conexión. Esto es más eficiente.
  // NOTA: express-mysql-session espera un pool de mysql2 (sin promise).
  // Pero con mysql2/promise, el pool interno funciona igualmente.
  clearExpired: true,             // Limpiar sesiones expiradas automáticamente
  checkExpirationInterval: 900000, // Revisar cada 15 minutos (en milisegundos)
  expiration: 86400000,           // Las sesiones expiran en 24 horas
  createDatabaseTable: true       // Crear la tabla 'sessions' automáticamente si no existe
};

// Crear el almacén de sesiones usando el pool existente
// pool.pool accede al pool interno de mysql2 (sin promise wrapper)
const sessionStore = new MySQLStore(sessionStoreOptions, pool.pool);

// ============================================================
// 6. CONFIGURACIÓN DE EXPRESS-SESSION
// ============================================================
// Configurar el middleware de sesiones. Cada opción está explicada.
// ============================================================
app.use(session({
  // Clave secreta para firmar la cookie de sesión.
  // Si alguien modifica la cookie, la firma no coincidirá y se rechazará.
  // Viene del archivo .env por seguridad.
  secret: process.env.SESSION_SECRET || 'clave_secreta_por_defecto',

  // store: dónde guardar los datos de sesión (MySQL en este caso)
  store: sessionStore,

  // resave: false = no guardar la sesión en cada petición si no cambió.
  // Mejora rendimiento porque evita escrituras innecesarias en MySQL.
  resave: false,

  // saveUninitialized: false = no crear sesión hasta que se guarde algo.
  // Esto evita crear sesiones vacías para visitantes que no hacen login.
  saveUninitialized: false,

  // Configuración de la cookie que se envía al navegador
  cookie: {
    secure: false,       // false = funciona sin HTTPS (desarrollo con XAMPP)
                         // En producción con HTTPS, cambiar a true
    httpOnly: true,      // true = JavaScript del navegador NO puede leer la cookie
                         // Esto previene ataques XSS que intenten robar la sesión
    maxAge: 24 * 60 * 60 * 1000, // 24 horas en milisegundos (86400000 ms)
    sameSite: 'lax'      // 'lax' = la cookie se envía en navegación normal
                         // pero NO en peticiones cross-site (protege contra CSRF)
  }
}));

// ============================================================
// 7. ARCHIVOS ESTÁTICOS
// ============================================================
// Servir los archivos del frontend (HTML, CSS, JS, imágenes)
// desde la carpeta 'public'. Express los sirve automáticamente.
//
// Ejemplo: El archivo public/css/styles.css se accede como
// http://localhost:3000/css/styles.css (sin 'public' en la URL)
//
// RELACIÓN CON: La carpeta public/ contiene todo el frontend
// que se comunica con este backend vía fetch() a las rutas /api/
// ============================================================
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// 8. MONTAJE DE RUTAS
// ============================================================
// Cada router se monta con un prefijo /api/. Esto separa las
// rutas de la API (JSON) de las páginas HTML (estáticas).
//
// Ejemplo: authRoutes define POST /registro, pero como se monta
// en /api/auth, la URL completa es POST /api/auth/registro
//
// CORRESPONDENCIA CON DIAGRAMAS:
//   - authRoutes → Casos de uso: Registrarse, Iniciar/Cerrar Sesión (imagen 2)
//   - productRoutes → Casos de uso: Buscar Productos, Filtrar (imagen 2)
//   - cartRoutes → Casos de uso: Agregar al Carrito (imagen 2)
//   - orderRoutes → Casos de uso: Realizar Compra (imagen 2)
//   - paymentRoutes → Diagrama de Secuencia: Proceso de Compra (imagen 5)
//   - supportRoutes → Casos de uso: Solicitar Soporte (imagen 2)
//   - adminRoutes → Casos de uso del Admin: Gestión completa (imagen 2)
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/productos', productRoutes);
app.use('/api/carrito', cartRoutes);
app.use('/api/pedidos', orderRoutes);
app.use('/api/pagos', paymentRoutes);
app.use('/api/soporte', supportRoutes);
app.use('/api/admin', adminRoutes);

// ============================================================
// 9. RUTA CATCH-ALL PARA PÁGINAS HTML
// ============================================================
// Si la petición NO es a /api/ y NO es un archivo estático,
// intentar servir una página HTML desde public/pages/.
// Esto permite tener URLs "limpias" como /login en vez de /pages/login.html
//
// Ejemplo:
//   GET /login → sirve public/pages/login.html
//   GET /carrito → sirve public/pages/carrito.html
//   GET / → sirve public/index.html (página principal)
// ============================================================
app.get('*', (req, res) => {
  // Si piden la raíz, servir index.html
  if (req.path === '/' || req.path === '/index.html') {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  // Intentar servir la página desde public/pages/
  const pagePath = path.join(__dirname, 'public', 'pages', `${req.path.slice(1)}.html`);
  res.sendFile(pagePath, (err) => {
    if (err) {
      // Si la página no existe, enviar un 404 amigable
      res.status(404).sendFile(path.join(__dirname, 'public', 'pages', '404.html'), (err404) => {
        if (err404) {
          // Si ni siquiera existe la página 404, enviar JSON
          res.status(404).json({
            success: false,
            message: 'Página no encontrada',
            data: null,
            errors: null
          });
        }
      });
    }
  });
});

// ============================================================
// 10. MIDDLEWARE GLOBAL DE MANEJO DE ERRORES
// ============================================================
// Este middleware captura CUALQUIER error no manejado en la
// aplicación. Express lo identifica porque tiene 4 parámetros
// (err, req, res, next) en vez de los 3 habituales.
//
// IMPORTANTE: Este middleware DEBE estar después de todas las
// rutas. Si un controlador lanza un error y no lo captura con
// try/catch, llegará aquí como red de seguridad.
//
// En producción, nunca enviar err.message al cliente (puede
// revelar información sensible). En desarrollo es útil para debug.
// ============================================================
app.use((err, req, res, next) => {
  // Registrar el error en la consola del servidor (para debugging)
  console.error('Error no manejado:', err.stack || err.message);

  // Responder al cliente con formato estándar
  res.status(err.status || 500).json({
    success: false,
    message: 'Error interno del servidor',
    data: null,
    errors: process.env.NODE_ENV === 'development' ? [{ message: err.message }] : null
  });
});

// ============================================================
// 11. INICIAR EL SERVIDOR
// ============================================================
// app.listen() arranca el servidor HTTP en el puerto configurado.
// testConnection() verifica que MySQL esté accesible antes de
// aceptar peticiones (viene de config/db.js).
//
// Si MySQL no está disponible, testConnection() detiene el proceso
// con process.exit(1) para evitar que el servidor corra sin BD.
// ============================================================
app.listen(PORT, async () => {
  console.log('============================================================');
  console.log(`Servidor corriendo en: http://localhost:${PORT}`);
  console.log('============================================================');

  // Verificar conexión a MySQL antes de aceptar peticiones
  await testConnection();

  console.log('============================================================');
  console.log('Rutas disponibles:');
  console.log('   Auth:      /api/auth      (registro, login, logout, perfil)');
  console.log('   Productos: /api/productos (catálogo, búsqueda, filtros)');
  console.log('   Carrito:   /api/carrito   (ver, agregar, actualizar, eliminar)');
  console.log('   Pedidos:   /api/pedidos   (crear, listar, detalle, cancelar)');
  console.log('   Pagos:     /api/pagos     (crear transacción, confirmar Webpay)');
  console.log('   Soporte:   /api/soporte   (crear ticket, listar, detalle)');
  console.log('   Admin:     /api/admin     (gestión completa del sistema)');
  console.log('============================================================');
});

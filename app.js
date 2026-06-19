// app.js: punto de entrada del servidor.
// Configura Express, sesiones, rutas y arranca el servidor.

// Cargar variables de entorno desde .env antes de cualquier otra cosa.
require('dotenv').config();

// Importaciones
const express = require('express');                   // Framework web principal
const session = require('express-session');           // Manejo de sesiones de usuario
const MySQLStore = require('express-mysql-session')(session); // Almacenar sesiones en MySQL
const path = require('path');                         // Utilidad para manejar rutas de archivos
const { pool, testConnection } = require('./config/db'); // Pool MySQL y función de prueba

// Importar routers de cada módulo.
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const supportRoutes = require('./routes/supportRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Crear la aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales para parsear JSON y formularios.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar el session store en MySQL para persistir sesiones.

// Opciones para el almacén de sesiones en MySQL
const sessionStoreOptions = {
  // Usar el pool existente de config/db.js con express-mysql-session.
  clearExpired: true,
  checkExpirationInterval: 900000,
  expiration: 86400000,
  createDatabaseTable: true
};

// Crear el almacén de sesiones usando el pool existente
// pool.pool accede al pool interno de mysql2 (sin promise wrapper)
const sessionStore = new MySQLStore(sessionStoreOptions, pool.pool);

// Configurar express-session con el session store en MySQL.
app.use(session({
  secret: process.env.SESSION_SECRET || 'clave_secreta_por_defecto',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// Servir archivos estáticos desde la carpeta public.
app.use(express.static(path.join(__dirname, 'public')));

// Montar routers de API bajo /api/*.
app.use('/api/auth', authRoutes);
app.use('/api/productos', productRoutes);
app.use('/api/carrito', cartRoutes);
app.use('/api/pedidos', orderRoutes);
app.use('/api/pagos', paymentRoutes);
app.use('/api/soporte', supportRoutes);
app.use('/api/admin', adminRoutes);

// Catch-all para servir páginas HTML desde public/pages.
app.get('*', (req, res) => {
  // Si piden la raíz, servir index.html
  if (req.path === '/' || req.path === '/index.html') {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  // Intentar servir la página desde public/pages/
  const pagePath = path.join(__dirname, 'public', 'pages', `${req.path.slice(1)}.html`);
  res.sendFile(pagePath, (err) => {
    if (err) {
      // Si la página no existe, enviar 404 amigable.
      res.status(404).sendFile(path.join(__dirname, 'public', 'pages', '404.html'), (err404) => {
        if (err404) {
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

// Middleware global de manejo de errores.
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

// Iniciar servidor y verificar conexión a MySQL.
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

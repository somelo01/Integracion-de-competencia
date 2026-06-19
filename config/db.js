// Configuración de base de datos MySQL usando mysql2/promise.
// Exporta un pool de conexiones reutilizables.

const mysql = require('mysql2/promise');
require('dotenv').config();

// Crear pool de conexiones con la configuración del .env
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',       // Servidor (XAMPP = localhost)
  port: process.env.DB_PORT || 3306,              // Puerto MySQL (XAMPP default = 3306)
  user: process.env.DB_USER || 'root',            // Usuario (XAMPP default = root)
  password: process.env.DB_PASS || '',            // Contraseña (XAMPP default = vacía)
  database: process.env.DB_NAME || 'tienda_ropa', // Nombre de la base de datos
  charset: 'utf8mb4',                             // Soporte completo de caracteres (ñ, emojis, etc.)
  waitForConnections: true,                        // Esperar si todas las conexiones están ocupadas
  connectionLimit: 10,                             // Máximo 10 conexiones simultáneas
  queueLimit: 0                                    // Sin límite de cola de espera
});

// Verifica la conexión a MySQL al arrancar el servidor.
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Conexión a MySQL exitosa - Base de datos:', process.env.DB_NAME);
    connection.release(); // Devolver la conexión al pool
  } catch (error) {
    console.error('Error al conectar a MySQL:', error.message);
    console.error('   Verifica que XAMPP esté corriendo y la base de datos exista.');
    process.exit(1); // Detener el servidor si no hay conexión a BD
  }
}

module.exports = { pool, testConnection };

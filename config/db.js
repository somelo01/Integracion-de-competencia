// ============================================================
// CONFIGURACIÓN DE BASE DE DATOS - MySQL (XAMPP)
// ============================================================
// Este archivo configura la conexión a MySQL usando un "pool"
// de conexiones. Un pool es como una "piscina" de conexiones
// abiertas que se reutilizan, en vez de abrir/cerrar una
// conexión nueva por cada consulta (más eficiente).
//
// IMPORTANTE: Usa mysql2/promise para poder usar async/await
// en los controladores en vez de callbacks anidados.
//
// CÓMO SE USA EN OTROS ARCHIVOS:
//   const pool = require('../config/db');
//   const [rows] = await pool.query('SELECT * FROM usuarios WHERE id_usuario = ?', [id]);
//
// Los "?" son placeholders parametrizados que PREVIENEN
// SQL Injection. NUNCA concatenar variables directamente:
//   MAL:  `SELECT * FROM usuarios WHERE id = ${id}`
//   BIEN: `SELECT * FROM usuarios WHERE id = ?`, [id]
// ============================================================

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

// ============================================================
// Función helper para verificar la conexión al iniciar el servidor.
// Se llama desde app.js al arrancar.
// ============================================================
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

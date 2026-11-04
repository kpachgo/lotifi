const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const requiredVariables = ['DB_HOST', 'DB_USER', 'DB_NAME'];
const missingVariables = requiredVariables.filter(name => !process.env[name]?.trim());
if (missingVariables.length) {
  throw new Error(`Faltan variables de base de datos en backend/.env: ${missingVariables.join(', ')}`);
}

const db = mysql.createPool({
  host: process.env.DB_HOST.trim(),
  user: process.env.DB_USER.trim(),
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME.trim(),
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10
});

// 🔎 Verificación de conexión
(async () => {
  try {
    const conn = await db.getConnection();
    console.log('✅ MySQL conectado a lotifi');
    conn.release();
  } catch (error) {
    console.error('❌ Error conectando a MySQL:', error);
  }
})();

module.exports = db;

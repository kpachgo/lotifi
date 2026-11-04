const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
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

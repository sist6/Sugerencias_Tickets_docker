// test-db.js
require('dotenv').config();          // carga .env
const db = require('./src/config/db');

(async () => {
  try {
    await db.connectDB();
    console.log('✅ Conexión a SQL Server OK');
    await db.disconnectDB();
  } catch (err) {
    console.error('❌ Falló la conexión:', err.message);
    console.error(err);
  }
})();
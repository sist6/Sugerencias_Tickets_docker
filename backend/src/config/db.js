/****************************************************************************************
 * src/config/db.js
 *
 * Configuración y helpers para conectar a Microsoft SQL Server desde Node.js.
 *
 * Exporta (entre otras cosas) la constante WS_URL → URL completa del WebSocket.
 ****************************************************************************************/

require('dotenv').config();          // Carga .env antes de leer process.env
const sql = require('mssql');

// -----------------------------------------------------------------------------
// 1️⃣  Configuración del driver mssql
// -----------------------------------------------------------------------------
const config = {
  server: process.env.DB_SERVER,
  ...(process.env.DB_PORT
    ? { port: parseInt(process.env.DB_PORT, 10) }
    : { instanceName: process.env.DB_INSTANCE }),

  database: process.env.DB_DATABASE || 'SOHOSystemsCore',

  // ── AUTENTICACIÓN ────────────────────────────────────────────────────────
  ...(process.env.DB_USER && process.env.DB_PASSWORD
    ? (process.env.DB_DOMAIN
        ? {
            authentication: {
              type: 'ntlm',
              options: {
                domain: process.env.DB_DOMAIN,
                userName: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
              },
            },
          }
        : {
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
          })
    : { authentication: { type: 'default' } }),

  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',  // convertir string a booleano
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',  // convertir string a booleano
    enableArithAbort: true,
  },

  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// -----------------------------------------------------------------------------
// 2️⃣  Construir la URL del WebSocket (siempre incluye el puerto)
// -----------------------------------------------------------------------------
function buildWsUrl() {
  const protocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';

  // Host que queremos exponer (puedes sobrescribir con WS_HOST)
  const host = process.env.WS_HOST || '192.168.125.52';

  // Puerto en el que la API escucha. Si no está definido usamos 4000 (desarrollo)
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

  // Siempre incluimos el puerto (excepto cuando el puerto es el estándar del
  // protocolo; en ese caso lo omitimos para que la URL quede “limpia”).
  const omitPort =
    (protocol === 'ws' && port === 80) ||
    (protocol === 'wss' && port === 443);
  const portSegment = omitPort ? '' : `:${port}`;

  // Path del WS (debe coincidir con el que uses en server.js)
  return `${protocol}://${host}${portSegment}/ws`;
}

const WS_URL = buildWsUrl();   // → ej. ws://192.168.125.52:4000/ws

// -----------------------------------------------------------------------------
// 3️⃣  Estado interno (pool + flag)
// -----------------------------------------------------------------------------
let pool = null;
let isConnected = false;

// -----------------------------------------------------------------------------
// 4️⃣  Funciones públicas
// -----------------------------------------------------------------------------
async function connectDB() {
  if (pool && isConnected) return pool;      // ya está conectado → reutilizar

  try {
    console.log('🔌 Conectando a SQL Server...');
    pool = await sql.connect(config);
    isConnected = true;

    // ---------- INFO de depuración ----------
     const safeUser = process.env.DB_USER ? '********' : '(integrated)';
    console.log('✅ Conexión a SQL Server establecida');
    console.log(`   -> Servidor      : ${config.server}`);
    console.log(`   -> Base de datos : ${config.database}`);
    console.log(`   -> Usuario       : ${safeUser}`);
    console.log(`   -> Puerto WS     : ${process.env.PORT || 4000}`);
    console.log(`   -> WS URL        : ${WS_URL}`);

    return pool;
  } catch (err) {
    isConnected = false;
    pool = null;
    console.error('❌ Error conectando a SQL Server:', err.message);
    console.log(
      'El sistema continuará sin conexión a base de datos. Revise las variables DB_* y reinicie cuando SQL Server esté disponible.'
    );
    console.log(process.env.DB_SERVER);
    throw err;
  }
}

async function disconnectDB() {
  if (pool) {
    await pool.close();
    pool = null;
    isConnected = false;
    console.log('🔌 Desconectado de SQL Server');
  }
}

function getPool() {
  return isConnected ? pool : null;
}

function isDBConnected() {
  return isConnected;
}

async function executeQuery(query, params = {}) {
  if (!isConnected) throw new Error('No hay conexión a la base de datos');

  const request = pool.request();
  for (const [k, v] of Object.entries(params)) request.input(k, v);
  return request.query(query);
}

async function executeProcedure(proc, params = {}) {
  if (!isConnected) throw new Error('No hay conexión a la base de datos');

  const request = pool.request();
  for (const [k, v] of Object.entries(params)) request.input(k, v);
  return request.execute(proc);
}

// -----------------------------------------------------------------------------
// 5️⃣  Exportar API pública
// -----------------------------------------------------------------------------
module.exports = {
  sql,
  connectDB,
  disconnectDB,
  getPool,
  isDBConnected,
  executeQuery,
  executeProcedure,
  config,
  WS_URL,               // <-- ahora disponible para cualquier módulo
};

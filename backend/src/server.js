/**
 * ------------------------------------------------------------
 *  SERVER (HTTP + WebSocket) – versión local (192.168.125.52)
 *
 *  - Sirve la API por HTTP (no HTTPS).  
 *  - WebSocket funciona sobre ws:// (no wss://).  
 *  - Escucha en 0.0.0.0 para que cualquier PC de la LAN pueda
 *    conectar usando  (solo útil en desarrollo).
 * ------------------------------------------------------------
 */

const { verifyToken } = require('./middleware/auth');
const { app } = require('./app');
const { PORT } = require('./config/env');
const {
  connectDB,
  disconnectDB,
  WS_URL,
} = require('./config/db');

const User  = require('./models/User');
const Hotel = require('./models/Hotel');

const http = require('http');
const { Server: WebSocketServer } = require('ws');

// <-- NUEVO: watchdog que revisa tickets y envía eventos WS
const TicketWatcher = require('./utils/ticketWatcher');

/* -----------------------------------------------------------------
   1️⃣  INICIAR la base de datos
   ----------------------------------------------------------------- */
async function start() {
  try {
    await connectDB();
  } catch (e) {
    console.warn(
      '⚠️  No se pudo conectar a la base de datos – API funciona en modo memoria.'
    );
  }

  // -------------------------------------------------
  // 2️⃣  Seed de datos (hoteles → usuarios)
  // -------------------------------------------------
  await Hotel.initTestData();   // asegura Central y Demo
  await User.initTestData();    // crea admin / tech / central

  // -------------------------------------------------
  // 3️⃣  Crear el servidor HTTP + WebSocket (ws)
  // -------------------------------------------------
  const httpServer = http.createServer(app);

  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',                 // coincidimos con REACT_APP_WS_URL
    verifyClient: (info, done) => {
      try{
        const url  = new URL(info.req.url, `http://${info.req.headers.host}`);
        const token = url.searchParams.get('token') || getTokenFromHeaders(info.req); // token en query (fallback)

        if(!token) {
          return done(false, 401, 'Token no proporcionado');
        }
        const decoded = verifyToken(token); // lanza si es inválido/expirado

        info.req.user = decoded.sub; // opcional: adjuntar info del usuario al request
        info.req.userRole = decoded.role; // opcional: rol del usuario
        return done(true); // token válido, permitir conexión
      }catch(e){
        return done(false, 401, 'Invalid token');
      }
    }
  });

  wss.on('connection', (socket, request) => {
  // Extraer token de la cookie (o querystring) para validar
  const cookieHeader = request.headers.cookie || '';
  const tokenMatch = cookieHeader.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;
  socket.userId = request.userId; // opcional: guardar userId en el socket para usarlo luego
  socket.userRole = request.userRole; // opcional: guardar rol del usuario en el socket

  if (!token) {
    // Si el cliente envía token por query (para entornos sin cookies)
    const url = new URL(`http://${request.headers.host}${request.url}`);
    const tokenQuery = url.searchParams.get('token');
    if (tokenQuery) token = tokenQuery;
  }

  try {
    verifyToken(token); // lanza si es inválido/expirado
  } catch (e) {
    socket.close(4001, 'Invalid token');
    return;
  }

  // Si está autorizado, enviamos el mensaje de bienvenida
  socket.send(
    JSON.stringify({
      type: 'WELCOME',
     payload: 'Conexión WS establecida',
    })
  );
});
  // -------------------------------------------------
  // 4️⃣  Iniciar el TicketWatcher (polling cada 5 s) y pasarle el WS
  // -------------------------------------------------
  const watcher = new TicketWatcher(5000, wss); // 5 s de intervalo
  watcher.start();

  // Hacemos las instancias accesibles globalmente (útil en rutas)
  global.wss = wss;
  global.watcher = watcher;

  // -------------------------------------------------
  // 5️⃣  Arrancar el servidor HTTP
  // -------------------------------------------------
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API corriendo en http://192.168.125.52:${PORT}`);
    console.log(`🟠 WebSocket disponible en ws://192.168.125.52:${PORT}/ws`);
  });
}
    // -------------------------------
    // 👉 ARRANCA EL BOT AQUÍ (después de levantar HTTP)
    // -------------------------------
    require('./bot/telegramBot');
/* -----------------------------------------------------------------
   6️⃣  CIERRE LIMPIO (Ctrl+C)
   ----------------------------------------------------------------- */
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');
  try {
    await disconnectDB();
  } catch (e) {
    console.warn('⚠️  Error al cerrar la BD:', e.message);
  }

  // Cerrar el WebSocketServer si existe
  if (global.wss) {
    console.log('🔌 Cerrando WebSocketServer...');
    global.wss.clients.forEach(client => client.terminate());
    global.wss.close(() => console.log('🔒 WebSocketServer cerrado'));
  }

  // Detener el watcher
  if (global.watcher && typeof global.watcher.stop === 'function') {
    global.watcher.stop();
    console.log('🕒 TicketWatcher detenido');
  }

  process.exit(0);
});


//HELPER para extraer token de headers (si no se envía por query)
function getTokenFromHeaders(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Extrae el token después de "Bearer "
  }
  const cookieHeader = req.headers.cookie || '';
  if (cookieHeader) {
    const tokenMatch = cookieHeader.match(/token=([^;]+)/);
    return tokenMatch ? tokenMatch[1] : null;
  }
  return null;
}
/* -----------------------------------------------------------------
   7️⃣  INICIAR
   ----------------------------------------------------------------- */
start().catch(err => {
  console.error('❌  Error inesperado al iniciar el servidor:', err);
  process.exit(1);
});

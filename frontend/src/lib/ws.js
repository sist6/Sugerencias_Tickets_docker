// src/lib/ws.js
// ----------------------------------------------------------
// Cliente WebSocket con reconexión automática y gestión de eventos
// ----------------------------------------------------------

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 3000;
let reconnectTimeout = null;
const listeners = new Set();

/* ------------------------------------------------------------------
   Token temporal en memoria (útil para flujos que no usan cookie,
   p.e. Microsoft‑AD). Se expone para que el AuthContext pueda
   escribirlo después de un login externo y borrarlo al logout.
   ------------------------------------------------------------------ */
let inMemoryToken = null;

/**
 * Guardar token en memoria.
 * @param {string} token
 */
export const setInMemoryToken = (token) => {
  inMemoryToken = token;
};

/**
 * Borrar token en memoria (logout).
 */
export const clearInMemoryToken = () => {
  inMemoryToken = null;
};

/**
 * Construye la URL del WS a partir de REACT_APP_WS_URL.
 * Si la variable ya incluye el esquema ws(s) lo respeta, si no,
 * lo transforma a ws(s) automáticamente.
 */
function buildWsUrl() {
  const raw = process.env.REACT_APP_WS_URL?.replace(/\/+$/, '') || '';
  if (!raw) return null;

  // Si ya es ws:// o wss:// lo usamos tal cual
  if (raw.startsWith('ws://') || raw.startsWith('wss://')) {
    return raw.endsWith('/ws') ? raw : `${raw}/ws`;
  }

  // Convertimos http(s) → ws(s)
  const protocol = raw.startsWith('https://') ? 'wss://' : 'ws://';
  const host = raw.replace(/^https?:\/\//, '');
  return `${protocol}${host}${raw.endsWith('/ws') ? '' : '/ws'}`;
}

/**
 * Obtiene el token que debe enviarse al servidor WS.
 * Prioridad:
 *   1️⃣  Parámetro `overrideToken`
 *   2️⃣  Token almacenado en memoria (`inMemoryToken`)
 *   3️⃣  Cookie “token” (solo dev: NO HttpOnly)
 *   4️⃣  Query‑string ?token= (para debugging)
 *
 * En producción las cookies son HttpOnly, por lo que el navegador
 * las envía automáticamente en el handshake y no es necesario
 * leerlas desde JS.
 *
 * @param {string|null} overrideToken
 * @returns {string|null}
 */
function getToken(overrideToken = null) {
  if (overrideToken) return overrideToken;

  if (inMemoryToken) return inMemoryToken;

  // Sólo para entornos de desarrollo donde la cookie no sea HttpOnly
  const cookieToken = getCookie('token');
  if (cookieToken) return cookieToken;

  // Debug: token en query‑string
  const url = new URL(window.location.href);
  return url.searchParams.get('token');
}

/**
 * Lee el valor de una cookie.
 * @param {string} name
 * @returns {string|null}
 */
function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp('(^| )' + name + '=([^;]+)')
  );
  return match ? decodeURIComponent(match[2]) : null;
}

/* -----------------------------------------------------------------
   API pública del módulo
   ----------------------------------------------------------------- */
export const getSocket = () => socket;

export const onMessage = (cb) => {
  listeners.add(cb);
  // Devuelve una función para desuscribirse
  return () => listeners.delete(cb);
};

export const closeSocket = () => {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (socket) {
    socket.close();
    socket = null;
  }
  reconnectAttempts = 0;
  listeners.clear();
};

export const sendMessage = (msg) => {
  const s = getSocket();
  if (!s) {
    console.warn('⚠️ WS no conectado → mensaje no enviado', msg);
    return false;
  }
  if (s.readyState !== WebSocket.OPEN) {
    console.warn('⚠️ WS no está OPEN → mensaje no enviado', msg);
    return false;
  }
  try {
    s.send(JSON.stringify(msg));
    return true;
  } catch (e) {
    console.error('❌ Error enviando mensaje WS', e, msg);
    return false;
  }
};

/**
 * Conecta al WebSocket. Si el backend usa cookies HttpOnly,
 * el token no es necesario en la URL; basta con que el navegador
 * lo envíe automáticamente. El parámetro `authToken` permite
 * forzar un token (p. ej. Microsoft login) que se añadirá a la
 * query‑string.
 */
export const connectSocket = (authToken = null) => {
  closeSocket(); // asegurar que no haya una conexión previa

  const token = getToken(authToken);
  const WS_URL = buildWsUrl();

  if (!WS_URL) {
    console.warn('⚠️ REACT_APP_WS_URL no está definido → WS deshabilitado');
    return null;
  }

  // Si hay token lo añadimos a la query‑string, si no el navegador enviará la cookie
  const wsUrlWithToken = token
    ? `${WS_URL}?token=${encodeURIComponent(token)}`
    : WS_URL;

  try {
    socket = new WebSocket(wsUrlWithToken);

    socket.addEventListener('open', () => {
      console.info('✅ WS conectado');
      reconnectAttempts = 0;
    });

    socket.addEventListener('close', (event) => {
      console.info('🔌 WS cerrado', event.code, event.reason);
      socket = null;
      // reconectar salvo que sea un cierre intencional (1000)
      if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        scheduleReconnect();
      }
    });

    socket.addEventListener('error', (e) => {
      console.error('❌ WS error', e);
      scheduleReconnect();
    });

    socket.addEventListener('message', (ev) => {
      let data;
      try {
        data = JSON.parse(ev.data);
      } catch {
        console.warn('⚠️ WS mensaje no JSON', ev.data);
        return;
      }
      listeners.forEach((cb) => cb(data));
    });

    return socket;
  } catch (error) {
    console.error('❌ Error creando WebSocket', error);
    scheduleReconnect();
    return null;
  }
};

/* -----------------------------------------------------------------
   Reconexión automática
   ----------------------------------------------------------------- */
function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.warn('❌ Demasiados intentos de reconexión, deteniendo');
    return;
  }

  reconnectAttempts++;
  console.log(
    `🔁 Intentando reconectar WS en ${RECONNECT_INTERVAL}ms (intento ${reconnectAttempts})`
  );

  reconnectTimeout = setTimeout(() => {
    console.log('🔁 Reconectando WebSocket…');
    connectSocket(); // sin token, confía en la cookie
  }, RECONNECT_INTERVAL);
}

/**
 * Inicializa la conexión sólo si no estamos en la página de login
 * (evita spams al cargar /login).
 */
export const initWebSocket = (token) => {
  if (window.location.pathname.includes('/login')) {
    console.log('⏭️ WS saltado en /login');
    return;
  }
  connectSocket(token);
};

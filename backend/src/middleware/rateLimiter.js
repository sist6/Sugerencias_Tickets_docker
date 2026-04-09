// src/middleware/rateLimiter.js
/**
 * Rate‑limit middleware (express-rate-limit)
 *
 * - global: 100 peticiones/15 min por IP
 * - login:  5 intentos/15 min por IP + email
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit'); // <-- IMPORTANTE

/* ---------- LÍMITE GLOBAL ---------- */
const globalLimiter = rateLimit({
  windowMs: 15*60*1000 , // 15 minutos
  max: 100,
  message: { error: 'Demasiadas peticiones, inténtalo más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ---------- LÍMITE LOGIN ---------- */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de login, espere 15 min' },

  // ✅ Usa la helper que soporta IPv4 e IPv6
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);                     // <-- gestiona IPv6 correctamente
    const email = (req.body?.email ?? '').trim().toLowerCase();
    return `${ip}-${email}`;
  },
  skip: (req) => {
  //if (!isProd) return true;               // dev → sin limitador
  // exclusión de todas las rutas de notificaciones
  return req.path.startsWith('/api/notifications');
},

  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  global: globalLimiter,
  login: loginLimiter,
};

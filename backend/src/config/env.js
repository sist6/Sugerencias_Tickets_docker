// src/config/env.js
// ------------------------------------------------------------
// Carga .env y expone las variables que necesita la API
// ------------------------------------------------------------
const path    = require('path');
const dotenv  = require('dotenv');

// Carga el archivo .env que esté en la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Variables que la aplicación utiliza.
 * Si alguna no está definida en .env, se usan los valores por defecto
 * (los valores por defecto son los que ya usamos en los snippets anteriores).
 */
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET no está definido');
  process.exit(1);
}
module.exports = {
  // ── Servidor ───────────────────────
  PORT:               Number(process.env.PORT) || 4000,          // puerto donde escucha Express
  // ── JWT ───────────────────────────
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN_HOURS: Number(process.env.JWT_EXPIRES_IN_HOURS) || 24,
  // ── CORS ──────────────────────────
  // Puede ser una lista separada por comas:  http://192.168.125.52:3000,https://app.sohohoteles.com
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '')
                    .split(',')
                    .map(o => o.trim())
                    .filter(o => o !== ''),
  // ── SQL Server (para el wrapper db.js) ───────────────────────
  DB_SERVER:          process.env.DB_SERVER          || '192.168.125.52',
  DB_PORT:            Number(process.env.DB_PORT)    || 1433,
  DB_DATABASE:        process.env.DB_DATABASE        || 'SOHOSystemsCore',
  DB_USER:            process.env.DB_USER            || 'sa',
  DB_PASSWORD:        process.env.DB_PASSWORD        || '',
  DB_ENCRYPT:         process.env.DB_ENCRYPT        === 'true',
  DB_TRUST_SERVER_CERTIFICATE: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',

  // ---- Microsoft / Azure AD ----
//REACT_APP_MSAL_CLIENT_ID:,   // Application (client) ID
//REACT_APP_MSAL_TENANT_ID:,   // Directory (tenant) ID
//REACT_APP_MSAL_REDIRECT_URI:'http://192.168.125.52:3000/auth/callback',   // o tu dominio prod
};


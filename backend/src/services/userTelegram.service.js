// src/services/userTelegram.service.js
const { executeQuery, isDBConnected } = require('../config/db');
const crypto = require('crypto');
const shortTokenCache = new Map(); // O persistir en tabla user_telegram_token

async function generateShortToken(userId) {
  const token = crypto.randomBytes(16).toString('hex'); // 32 caracteres
  const expires = Date.now() + 15 * 60 * 1000; // 15 min
  shortTokenCache.set(token, { userId, expires });
  return token;
}

async function verifyShortToken(token) {
  const entry = shortTokenCache.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    shortTokenCache.delete(token);
    return null;
  }
  return entry.userId;
}
/* -----------------------------------------------------------------
   1️⃣  Guardar (o actualizar) chat_id → enabled = true por defecto
----------------------------------------------------------------- */
async function updateTelegramChat(userId, chatId) {
  if (isDBConnected()) {
    // MERGE (SQL Server) – adapta si usas otro motor
    await executeQuery(
      `MERGE INTO user_telegram AS target
       USING (SELECT @userId AS user_id, @chatId AS chat_id) AS source
       ON target.user_id = source.user_id
       WHEN MATCHED THEN
         UPDATE SET chat_id = source.chat_id, enabled = 1, updated_at = GETDATE()
       WHEN NOT MATCHED THEN
         INSERT (user_id, chat_id, enabled) VALUES (source.user_id, source.chat_id, 1);`,
      { userId, chatId }
    );
  } else {
    // Modo memoria (tests) → simple Map
    const map = global.__userTelegramMap || (global.__userTelegramMap = new Map());
    map.set(userId, { chatId, enabled: true });
  }
}

/* -----------------------------------------------------------------
   2️⃣  Obtener estado (linked / enabled)
----------------------------------------------------------------- */
async function getStatus(userId) {
  if (isDBConnected()) {
    const result = await executeQuery(
      `SELECT chat_id, enabled FROM user_telegram WHERE user_id = @userId`,
      { userId }
    );
    const row = result.recordset[0];
    if (!row) return { linked: false };
    return { linked: true, chat_id: row.chat_id, enabled: !!row.enabled };
  } else {
    const map = global.__userTelegramMap || (global.__userTelegramMap = new Map());
    const entry = map.get(userId);
    if (!entry) return { linked: false };
    return { linked: true, chat_id: entry.chatId, enabled: !!entry.enabled };
  }
}

/* -----------------------------------------------------------------
   3️⃣  Activar / desactivar notificaciones
----------------------------------------------------------------- */
async function setEnabled(userId, enabled) {
  if (isDBConnected()) {
    await executeQuery(
      `UPDATE user_telegram SET enabled = @enabled WHERE user_id = @userId`,
      { userId, enabled: enabled ? 1 : 0 }
    );
  } else {
    const map = global.__userTelegramMap || (global.__userTelegramMap = new Map());
    const entry = map.get(userId);
    if (entry) entry.enabled = enabled;
    else map.set(userId, { chatId: null, enabled });
  }
}

// -------------------------------------------------
//   Obtener user_id a partir de un chat_id (útil cuando el bot se reinicia)
// -------------------------------------------------
async function getUserIdByChatId(chatId) {
  if (isDBConnected()) {
    const result = await executeQuery(
      `SELECT user_id FROM user_telegram WHERE chat_id = @chatId`,
      { chatId }
    );
    return result.recordset[0]?.user_id || null;
  } else {
    const map = global.__userTelegramMap || (global.__userTelegramMap = new Map());
    for (const [uid, data] of map.entries()) {
      if (data.chatId === chatId) return uid;
    }
    return null;
  }
}

/**
 * Devuelve el chat_id de un usuario sólo si está enlazado y tiene
 * las notificaciones habilitadas.
 *
 * @param {string} userId  GUID del usuario
 * @returns {Promise<string|null>} chat_id o null
 */
async function getEnabledChatId(userId) {
  const status = await getStatus(userId);
  if (status.linked && status.enabled) {
    return status.chat_id;
  }
  return null;
}

module.exports = {
  updateTelegramChat,
  getStatus,
  setEnabled,
  generateShortToken,
  verifyShortToken,
  getEnabledChatId,
  getUserIdByChatId,
};

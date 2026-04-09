// src/controllers/userTelegram.controller.js
require('dotenv').config();
const jwt = require('jsonwebtoken');
const {
  updateTelegramChat,
  getStatus,
  setEnabled,
  generateShortToken,
  verifyShortToken,
} = require('../services/userTelegram.service');

/* -------------------------------------------------
   1️⃣  Enlace deep‑link (GET /users/:id/telegram-link)
   ------------------------------------------------- */
const getTelegramLink = async (req, res, next) => {
 try {
    const userId = req.user.sub;
    const token = await generateShortToken(userId); // <‑64 caracteres
    const link = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(token)}`;
    res.json({ link });
  } catch (e) {
    next(e);
  }
};

/* -------------------------------------------------
   2️⃣  Estado del vínculo (GET /users/:id/telegram)
   ------------------------------------------------- */
const getTelegramStatus = async (req, res, next) => {
  try {
    const userId = req.params.id;                 // string, no Number
    const status = await getStatus(userId);
    res.json(status);
  } catch (e) {
    next(e);
  }
};

/* -------------------------------------------------
   3️⃣  Activar / desactivar (PATCH /users/:id/telegram)
   ------------------------------------------------- */
const patchTelegramStatus = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { enabled } = req.body;
    await setEnabled(userId, !!enabled);
    res.json({ ok: true, enabled: !!enabled });
  } catch (e) {
    next(e);
  }
};

/* -------------------------------------------------
   4️⃣  Guardar chat_id (POST /users/:id/telegram) – interno
   ------------------------------------------------- */
const botSaveChatId = async (req, res, next) => {
  try {
    const userId = req.params.id;           // viene de la URL
    const { chatId } = req.body;            // lo envía el bot

    if (!chatId) {
      return res.status(400).json({ error: 'chatId es requerido' });
    }

    //console.log('📥 botSaveChatId → userId:', userId, 'chatId:', chatId);
    await updateTelegramChat(userId, chatId);
    //console.log('✅ updateTelegramChat OK para', userId);

    res.json({ ok: true });
  } catch (e) {
    console.error('❌ error en botSaveChatId:', e);
    next(e);
  }
};

module.exports = {
  getTelegramLink,
  getTelegramStatus,
  patchTelegramStatus,
  botSaveChatId,
};

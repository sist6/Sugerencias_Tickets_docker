// src/models/Notification.js
const { generateId, formatDateForSQL } = require('../utils/helpers');
const { isDBConnected, executeQuery } = require('../config/db');
const { NotificationType } = require('../utils/constants');

const store = new Map();

async function findAllForUser(userId) {
  if (isDBConnected()) {
    const result = await executeQuery(
      `SELECT * FROM notifications WHERE user_id = @userId ORDER BY created_at DESC`,
      { userId }
    );
    return result.recordset;
  }
  return Array.from(store.values()).filter(n => n.user_id === userId);
}

async function countUnread(userId) {
  const all = await findAllForUser(userId);
  return all.filter(n => !n.is_read).length;
}

async function create(data) {
  const notif = {
    id: generateId(),
    user_id: data.user_id,
    title: data.title,
    message: data.message,
    type: data.type || NotificationType.INFO,
    link: data.link || null,
    is_read: data.is_read ? 1 : 0,
    created_at: formatDateForSQL(),
  };

  if (isDBConnected()) {
    await executeQuery(
      `INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
       VALUES (@id, @user_id, @title, @message, @type, @link, @is_read, @created_at)`,
      notif
    );
  } else {
    store.set(notif.id, notif);
  }

 // ---------------------------------------------------------
  //  Sólo enviamos a Telegram si la notificación pertenece a tickets
  // ---------------------------------------------------------
  if (notif.type && notif.type.startsWith('TICKET_')) {
    try {
      const result = await executeQuery(
        `SELECT chat_id, enabled FROM user_telegram WHERE user_id = @userId`,
        { userId: notif.user_id }
      );
      const row = result.recordset[0];
      if (row && row.enabled) {
        await sendTelegramMessage(row.chat_id, {
          title: notif.title,
          message: notif.message,
          type: notif.type,
          link: notif.link,
        });
      }
    } catch (err) {
      console.error('Error enviando notificación de ticket a Telegram', err);
    }
  }
  return notif;
}



async function markAsRead(id) {
  if (isDBConnected()) {
    await executeQuery(`UPDATE notifications SET is_read = 1 WHERE id = @id`, { id });
  } else {
    const n = store.get(id);
    if (n) n.is_read = 1;
  }
  return findById(id);
}

async function markAllReadForUser(userId) {
  if (isDBConnected()) {
    await executeQuery(`UPDATE notifications SET is_read = 1 WHERE user_id = @userId`, {
      userId,
    });
    const updated = await findAllForUser(userId);
    return updated;
  } else {
    for (const n of store.values()) {
      if (n.user_id === userId) n.is_read = 1;
    }
    return findAllForUser(userId);
  }
}

async function findById(id) {
  if (isDBConnected()) {
    const result = await executeQuery(`SELECT * FROM notifications WHERE id = @id`, { id });
    return result.recordset[0] || null;
  }
  return store.get(id) || null;
}

module.exports = {
  findAllForUser,
  countUnread,
  create,
  markAsRead,
  markAllReadForUser,
  findById,
};

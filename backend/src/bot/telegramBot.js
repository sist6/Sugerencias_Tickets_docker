// src/bot/telegramBot.js
require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { TicketStatus } = require('../utils/constants');
const { verifyShortToken } = require('../services/userTelegram.service');
const User = require('../models/User');
const {UserRoles} = require('../utils/constants');
const { executeQuery } = require('../config/db'); 
const {
  getUserIdByChatId,
} = require('../services/userTelegram.service');
/* -------------------------------------------------
   MAPA temporal para respuestas de texto
------------------------------------------------- */
const pendingReplies = new Map(); // chatId -> ticketId
const pendingResolutionStep = new Map(); // chatId -> 'awaitNumber' | 'awaitDescription'
const pendingResolutionData = new Map(); // chatId -> { ticketId, solutionTypes, chosenSolution? }
const chatUserMap = new Map(); // chatId -> userId (para respuestas rápidas)
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
/* -------------------------------------------------
   Helper – escape HTML
------------------------------------------------- */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* -------------------------------------------------
   Helper – muestra el chat_id al usuario
------------------------------------------------- */
function chatIdMessage(chatId) {
  return `Tu <b>chat_id</b> es:\n<code>${chatId}</code>\n` +
         `Puedes volver a enlazar tu cuenta en la app si lo necesitas.`;
}

/**
 * Comprueba que el usuario cuyo `userId` está asociado al chat
 * tenga el rol ADMIN o TECHNICIAN.  Si no lo tiene,
 * envía un mensaje y devuelve `false`.
 * Si el usuario no está enlazado, también informa.
 */
async function ensureTechOrAdmin(ctx, userId) {
  if (!userId) {
    await ctx.reply(
      '⚠️ Tu cuenta de Telegram no está vinculada. Usa el enlace “Conectar Telegram” desde la app.'
    );
    return false;
  }

  try {
    const user = await User.findById(userId);
    const role = user?.role;
    if (!role) {
      await ctx.reply('⚠️ No se pudo obtener tu rol. Contacta con soporte.');
      return false;
    }
    if (![UserRoles.ADMIN, UserRoles.TECHNICIAN].includes(role)) {
      await ctx.reply(
        '🚫 Sólo los usuarios con rol **técnico** o **admin** pueden usar este bot.'
      );
      return false;
    }
    return true;               // rol permitido
  } catch (e) {
    console.error('❌ error obteniendo rol del usuario →', e);
    await ctx.reply('⚠️ Error interno al validar permisos.');
    return false;
  }
}

async function listSolutionTypes() {
  const result = await executeQuery(
    `SELECT id, name FROM solution_types ORDER BY name`,
    {}
  );
  return result.recordset; // [] si no hay nada
}

async function askForSolutionType(ctx, ticketId) {
  const types = await listSolutionTypes();

  if (!types.length) {
    await ctx.reply('⚠️ No hay tipos de solución definidos en el sistema.');
    return;
  }

  // Guardamos los datos temporales
  pendingResolutionStep.set(ctx.chat.id, 'awaitNumber');
  pendingResolutionData.set(ctx.chat.id, {
    ticketId,
    solutionTypes: types, // para validar el número después
  });

  // Construimos la lista numerada
  const lines = types.map((t, i) => `${i + 1}. ${t.name}`);
  const message = `📋 Selecciona el <b>Tipo de Solución</b> que corresponde (responde con el número):\n\n` +
                  lines.join('\n');

  await ctx.replyWithHTML(message, { parse_mode: 'HTML' });
}



/* -------------------------------------------------
   Enlaza el chat_id en el backend
------------------------------------------------- */
async function linkChatInBackend(userId, chatId) {
  const url = `${process.env.API_BASE_URL}/api/users/${userId}/telegram`;
  //console.log('🔗 linkChatInBackend → POST', url, 'body:', { chatId });
  try {
    const resp = await axios.post(
      url,
      { chatId },
      {
        headers: {
          'x-internal-secret': process.env.INTERNAL_API_SECRET,
        },
      }
    );
    //console.log('✅ POST OK →', resp.status, resp.data);
    return true;
  } catch (e) {
    if (e.response) {
      console.error(
        `❌ POST FAILED → ${e.response.status} ${e.response.statusText}`,
        e.response.data
      );
    } else {
      console.error('❌ POST ERROR →', e.message);
    }
    return false;
  }
}

/* -------------------------------------------------
   ENVIAR NOTIFICACIÓN (usado por Notification model)
------------------------------------------------- */
async function sendTelegramMessage(chatId, notif) {
  const text = `🔔 <b>${escapeHtml(notif.title)}</b>\n${escapeHtml(notif.message)}`;

  const opts = {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  if (notif.type && notif.type.startsWith('ticket_') && notif.link) {
    const match = notif.link.match(/\/tickets\/([^/]+)/);
    if (match) {
      const ticketId = match[1];
      opts.reply_markup = {
        inline_keyboard: [
          [
            {
              text: '✉️ Responder',
              callback_data: `reply_ticket_${ticketId}`,
            },
          ],
        ],
      };
    }
  }

  try {
    await bot.telegram.sendMessage(chatId, text, opts);
  } catch (err) {
    console.error(`Telegram send error (chatId=${chatId})`, err);
  }
}

/* -------------------------------------------------
   /start <jwt>
------------------------------------------------- */
bot.start(async (ctx) => {
  const chatId = ctx.chat.id;
  const token   = ctx.startPayload; // será el token corto
  //console.log('🤖 /start recibido – payload:', token);

  if (!token) {
    return ctx.replyWithHTML(
      `👋 <b>¡Hola!</b>\n` +
      `Tu <b>chat_id</b> es:\n<code>${chatId}</code>\n` +
      `\nPara enlazar tu cuenta pulsa “Conectar Telegram” en la aplicación y genera el enlace.`
    );
  }

  const userId = await verifyShortToken(token);
  if (!userId) {
    console.error('❌ token corto inválido o expirado');
    return ctx.reply('⚠️ Enlace inválido o expirado. Vuelve a generar el enlace desde la app.');
  }
   // GUID del usuario del sistema
  const ok = await linkChatInBackend(userId, chatId);

  if (ok) {
    // Guardamos la relación en memoria (más rápido para respuestas)
    chatUserMap.set(chatId, userId);
    await ctx.replyWithHTML(
      `✅ <b>¡Listo!</b> Tu cuenta ya está enlazada.\n` +
      `Recibirás notificaciones de tus tickets aquí en Telegram.`
    );
  } else {
    await ctx.reply('❌ No se pudo enlazar la cuenta. Contacta con soporte.');
  }
});
/* -------------------------------------------------
   /estado <partialId> <estado‑en‑español>
------------------------------------------------- */
bot.command('estado', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    return ctx.reply(
      'Uso: /estado <5‑caracteres> <nuevo_estado> [<nombre_solución> <descripción>]\n' +
      'Ejemplos:\n' +
      '  • Cambiar a cerrado:  /estado abc12 cerrado\n' +
      '  • Marcar como resuelto:  /estado abc12 resuelto'
    );
  }

  // -------------------------------------------------
  // 0️⃣  Desglosar argumentos
  // -------------------------------------------------
  const [partial, rawStatus, ...rest] = args;
  const statusKey = rawStatus.toLowerCase().replace(/\s+/g, '_');

  const statusMap = {
    nuevo: TicketStatus.NEW,
    asignado: TicketStatus.ASSIGNED,
    en_progreso: TicketStatus.IN_PROGRESS,
    progreso: TicketStatus.IN_PROGRESS,
    esperando_respuesta: TicketStatus.WAITING_RESPONSE,
    espera: TicketStatus.WAITING_RESPONSE,
    resuelto: TicketStatus.RESOLVED,
    cerrado: TicketStatus.CLOSED,
    cancelado: TicketStatus.CANCELLED,
  };
  const statusConst = statusMap[statusKey];
  if (!statusConst) {
    return ctx.reply(
      `❌ Estado "${rawStatus}" no reconocido.\n` +
      `Estados válidos: ${Object.keys(statusMap).join(', ')}`
    );
  }

  // -------------------------------------------------
  // 1️⃣  Obtener userId del chat y validar rol (solo admin/tech)
  // -------------------------------------------------
  const chatId = ctx.chat.id;
  let userId = chatUserMap.get(chatId);
  if (!userId) {
    userId = await getUserIdByChatId(chatId);
    if (userId) chatUserMap.set(chatId, userId);
  }
  if (!(await ensureTechOrAdmin(ctx, userId))) return;   // aborta si no tiene permiso

  // -------------------------------------------------
  // 2️⃣  Buscar el ticket (solo los 5 caracteres)
  // -------------------------------------------------
  let ticket;
  try {
    const resp = await axios.get(
      `${process.env.API_BASE_URL}/api/tickets/partial/${partial}`,
      {
        headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET },
      }
    );
    ticket = resp.data;
  } catch (e) {
    console.error('Error fetching ticket by partial', e);
    return ctx.reply('❌ No se encontró ticket con esos 5 caracteres.');
  }

  // -------------------------------------------------
  // 3️⃣  Permisos ADMIN vs TECH (admin puede tocar cualquier ticket)
  // -------------------------------------------------
  const updater = await User.findById(userId);
  const isAdmin = updater?.role === UserRoles.ADMIN;
  if (!isAdmin && ticket.assigned_to !== userId) {
    return ctx.reply(
      '⚠️ Sólo puedes cambiar el estado de tickets que estén asignados a ti.'
    );
  }

  // -------------------------------------------------
  // 4️⃣  Si el nuevo estado NO es RESUELTO → envío directo
  // -------------------------------------------------
  if (statusConst !== TicketStatus.RESOLVED) {
    // payload sencillo (status + posible asignado/priority)
    const payload = { status: statusConst };

    try {
      await axios.patch(
        `${process.env.API_BASE_URL}/api/tickets/${ticket.id}/bot-status`,
        { ...payload, user_id: userId },
        {
          headers: {
            'x-internal-secret': process.env.INTERNAL_API_SECRET,
          },
        }
      );
      await ctx.replyWithHTML(
        `✅ Ticket <code>${ticket.id.slice(0, 5)}</code> actualizado a <b>${statusKey}</b>.`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      const msg = err.response?.data?.error || '⚠️ No se pudo actualizar el estado.';
      await ctx.reply(msg);
    }
    return;
  }

  // -------------------------------------------------
  // 5️⃣  Estado = RESUELTO → iniciar flujo interactivo
  // -------------------------------------------------
  // Si el usuario ya pasó datos extra (`nombre solución` + descripción) en la misma línea,
  // los tratamos como antes (para compatibilidad):
  if (rest.length >= 2) {
    // Caso “/estado <partial> resuelto <nombre> <descripción>”
    const solutionName = rest[0];
    const solutionDesc = rest.slice(1).join(' ');
    const solutionRec = await getSolutionTypeByName(solutionName);
    if (!solutionRec) {
      return ctx.reply(
        `⚠️ No existe ningún tipo de solución llamado "${solutionName}". ` +
        'Comprueba el nombre o crea el tipo en la aplicación.'
      );
    }
    // Enviamos de inmediato:
    try {
      await axios.patch(
        `${process.env.API_BASE_URL}/api/tickets/${ticket.id}/bot-status`,
        {
          status: TicketStatus.RESOLVED,
          solution_type_id: solutionRec.id,
          solution: solutionDesc,
          user_id: userId,
        },
        {
          headers: {
            'x-internal-secret': process.env.INTERNAL_API_SECRET,
          },
        }
      );
      await ctx.replyWithHTML(
        `✅ Ticket <code>${ticket.id.slice(0, 5)}</code> marcado como <b>resuelto</b>.`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      const msg = err.response?.data?.error || '⚠️ No se pudo marcar como resuelto.';
      await ctx.reply(msg);
    }
    return;
  }

  // Si llegamos aquí, el usuario solo escribió “/estado … resuelto”.
  // En ese caso iniciamos el **diálogo numérico**:
  await askForSolutionType(ctx, ticket.id);
});

/* -----------------------------------------------------------------
   ESCUCHAR TEXTOS (para el flujo interactivo de /estado → RESUELTO)
   ----------------------------------------------------------------- */
bot.on('text', async (ctx,next) => {
  const chatId = ctx.chat.id;

  // Si no hay paso pendiente, simplemente ignoramos (el texto pertenece a otro comando)
  const step = pendingResolutionStep.get(chatId);
  if (!step) return next(); // nada que hacer aquí

  const data = pendingResolutionData.get(chatId);
  if (!data) {
    // Estado inconsistente – limpiamos por seguridad
    pendingResolutionStep.delete(chatId);
    pendingResolutionData.delete(chatId);
    return;
  }

  // ------------------- PASO 1: NUMERO DE SOLUCIÓN -------------------
  if (step === 'awaitNumber') {
    const num = parseInt(ctx.message.text.trim(), 10);
    const types = data.solutionTypes;

    if (isNaN(num) || num < 1 || num > types.length) {
      await ctx.reply(`❌ Número inválido. Escribe un número entre 1 y ${types.length}.`);
      return; // sigue esperando número correcto
    }

    // Guardamos el id del tipo seleccionado y cambiamos al siguiente paso
    const chosen = types[num - 1];
    data.chosenSolution = { id: chosen.id, name: chosen.name };
    pendingResolutionStep.set(chatId, 'awaitDescription');
    pendingResolutionData.set(chatId, data);

    await ctx.reply(
      `📝 Ahora escribe una breve **descripción** de cómo se resolvió el ticket.\n` +
      `Ejemplo: “Se reinició el router y el cliente confirmó que la red vuelve a funcionar”.`
    );
    return;
  }

  // ------------------- PASO 2: DESCRIPCIÓN -------------------
  if (step === 'awaitDescription') {
    const description = ctx.message.text.trim();
    if (!description) {
      await ctx.reply('⚠️ La descripción no puede estar vacía. Escríbela de nuevo.');
      return;
    }

    // Recuperamos la información del ticket y del solution_type seleccionado
    const { ticketId, chosenSolution } = data;
    const userId = chatUserMap.get(chatId) || (await getUserIdByChatId(chatId));

    // Enviamos al endpoint interno
    try {
      await axios.patch(
        `${process.env.API_BASE_URL}/api/tickets/${ticketId}/bot-status`,
        {
          status: TicketStatus.RESOLVED,
          solution_type_id: chosenSolution.id,
          solution: description,
          user_id: userId,
        },
        {
          headers: {
            'x-internal-secret': process.env.INTERNAL_API_SECRET,
          },
        }
      );

      await ctx.replyWithHTML(
        `✅ Ticket <code>${ticketId.slice(0, 5)}</code> marcado como <b>resuelto</b>.\n` +
        `Tipo de solución: <i>${chosenSolution.name}</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      const msg = err.response?.data?.error || '⚠️ No se pudo guardar la resolución.';
      await ctx.reply(msg);
    }

    // Limpiamos los mapas (diálogo terminado)
    pendingResolutionStep.delete(chatId);
    pendingResolutionData.delete(chatId);
    return;
  }
});


bot.command('ayuda', async (ctx) => {
const helpMsg = `
🛠️ <b>Comandos del bot</b>

/start <code>token</code>                – Enlaza tu cuenta de Telegram con el backend.
/estado <code>5‑caracteres</code> <code>estado</code> – Cambia el estado de un ticket.
                • Si <code>estado</code> = resuelto → el bot te guiará para elegir el tipo de solución.
                • Estados válidos: nuevo, asignado, en_progreso, esperando_respuesta, resuelto, cerrado, cancelado.
                • Ejemplo: /estado abc12 cerrado
/mios           – Lista los tickets que tienes asignados.
/nuevos         – Muestra los 5 tickets sin asignar (solo admin/tech).
/tomar <code>5‑caracteres</code>         – Asigna a ti mismo un ticket sin asignar.
/respuesta <code>ticketId</code> <code>texto</code> – Añade un comentario externo al ticket.
/ayuda         - Muestra este mensaje.

⚠️ Sólo los usuarios con rol <b>admin</b> o <b>technician</b> pueden usar los comandos que modifican tickets.
     Los demás solo pueden enlazar su cuenta y leer notificaciones.

¡Estamos a tu disposición!`;

  // No hace falta pasar parse_mode porque `replyWithHTML` ya lo usa por defecto.
  await ctx.replyWithHTML(helpMsg);
});
/* -------------------------------------------------
   /mios – lista los tickets asignados a ti
------------------------------------------------- */
bot.command('mios', async (ctx) => {
  const chatId = ctx.chat.id;
  let userId = chatUserMap.get(chatId);
  if (!userId) {
    userId = await getUserIdByChatId(chatId);
    if (userId) chatUserMap.set(chatId, userId);
  }
  if (!userId) {
    return ctx.reply(
      '⚠️ Tu cuenta de Telegram no está vinculada. Usa el enlace “Conectar Telegram” desde la app.'
    );
  }

  try {
    const resp = await axios.get(
      `${process.env.API_BASE_URL}/api/tickets/assigned/${userId}`,
      {
        headers: {
          'x-internal-secret': process.env.INTERNAL_API_SECRET,
        },
      }
    );

    const tickets = resp.data;

    if (!Array.isArray(tickets) || tickets.length === 0) {
      return ctx.reply('No tienes tickets asignados.');
    }

    const list = tickets
      .map((t, i) => {
        const shortId = t.id.slice(0, 5);
        const title   = t.title.length > 30
          ? t.title.slice(0, 27) + '…'
          : t.title;
        const status  = t.status; // enum tal cual
        return `${i + 1}. <code>${shortId}</code> – ${escapeHtml(title)} (${status})`;
      })
      .join('\n');

    await ctx.replyWithHTML(` Tus tickets asignados:\n${list}`);
  } catch (err) {
    console.error('Error fetching /mios', err);
    await ctx.reply('⚠️ No se pudieron obtener tus tickets.');
  }
});

/* -------------------------------------------------
   /nuevos – muestra los 5 tickets sin asignar
------------------------------------------------- */
bot.command('nuevos', async (ctx) => {
  try {
    const resp = await axios.get(
      `${process.env.API_BASE_URL}/api/tickets/unassigned`,
      {
        headers: {
          'x-internal-secret': process.env.INTERNAL_API_SECRET,
        },
      }
    );

    const tickets = resp.data;

    if (!Array.isArray(tickets) || tickets.length === 0) {
      return ctx.reply('📭 No hay tickets sin asignar.');
    }

    // Formato bonito (usamos <code> para los IDs, ya era válido)
    const list = tickets
      .map((t, i) => {
        const shortId = t.id.slice(0, 5);
        const title   = t.title.length > 30
          ? t.title.slice(0, 27) + '…'
          : t.title;
        return `${i + 1}. <code>${shortId}</code> – ${escapeHtml(title)}`;
      })
      .join('\n');

    // ***** IMPORTANTE: escapamos los símbolos < y >  *****
    const msg = `🆕 Tickets sin asignar (máximo 5):\n${list}\n\n` +
                `Para tomar uno escribe:\n` +
                `/tomar <code>primeros5caracteres</code>\n` +
                `Ejemplo: /tomar ${tickets[0].id.slice(0, 5)}`;

    await ctx.replyWithHTML(msg);
  } catch (err) {
    console.error('Error fetching /nuevos', err);
    await ctx.reply('⚠️ No se pudieron obtener los tickets.');
  }
});
/* -------------------------------------------------
   /tomar <partialId> – asigna el ticket al usuario
------------------------------------------------- */
bot.command('tomar', async (ctx) => {
  const parts = ctx.message.text.trim().split(' ');
  if (parts.length < 2) {
    return ctx.reply(
      'Uso: /tomar <5‑caracteres‑del‑ticket>\nEjemplo: /tomar a1b2c'
    );
  }
  const partial = parts[1].toLowerCase();

  // 1️⃣  user_id (GUID) del usuario de Telegram
  const chatId = ctx.chat.id;
  let userId = chatUserMap.get(chatId);
  if (!userId) {
    userId = await getUserIdByChatId(chatId);
    if (userId) chatUserMap.set(chatId, userId);
  }
  if (!userId) {
    return ctx.reply(
      '⚠️ Tu cuenta de Telegram no está vinculada. Usa el enlace “Conectar Telegram” desde la app.'
    );
  }

  try {
    // 2️⃣  Pedir la lista de tickets libres (nuevos endpoint)
    const listResp = await axios.get(
      `${process.env.API_BASE_URL}/api/tickets/unassigned`,
      {
        headers: {
          'x-internal-secret': process.env.INTERNAL_API_SECRET,
        },
      }
    );
    const tickets = listResp.data;

    // 3️⃣  Encontrar el ticket cuyo ID empieza con los 5 caracteres enviados
    const ticket = tickets.find((t) => t.id.toLowerCase().startsWith(partial));
    if (!ticket) {
      return ctx.reply('❌ No se encontró ticket libre con esos caracteres.');
    }

    // 4️⃣  Llamar al endpoint interno que **toma** el ticket
    const takeResp = await axios.post(
      `${process.env.API_BASE_URL}/api/tickets/${ticket.id}/take`,
      { user_id: userId },                // GUID del usuario
      {
        headers: {
          'x-internal-secret': process.env.INTERNAL_API_SECRET,
        },
      }
    );

    await ctx.replyWithHTML(
      `✅ Ticket <code>${ticket.id.slice(0, 5)}</code> asignado a ti.\n` +
      `Título: ${escapeHtml(takeResp.data.title || '')}`
    );
  } catch (err) {
    console.error('Error in /tomar', err);
    const msg = err.response?.data?.error || '⚠️ No se pudo asignar el ticket.';
    await ctx.reply(msg);
  }
});
/* -------------------------------------------------
   /respuesta <ticketId> <texto>
------------------------------------------------- */
bot.command('respuesta', async (ctx) => {
  // -------------------------------------------------
  // 1️⃣  Parseamos el mensaje
  // -------------------------------------------------
  const parts = ctx.message.text.split(' ');
  if (parts.length < 3) {
    return ctx.reply(
      'Uso: /respuesta <ticketId> <texto>\nEjemplo: /respuesta 5a3b7c El cliente aprobó.'
    );
  }

  // ---- Sólo tomamos los 5 primeros caracteres ----------
  const rawId   = parts[1];
  const partial = rawId.slice(0, 5).toLowerCase(); // “5a3b7c…”
  const content = parts.slice(2).join(' ');

  // -------------------------------------------------
  // 2️⃣  Resolución del GUID completo del ticket
  // -------------------------------------------------
  let ticket;
  try {
    const resp = await axios.get(
      `${process.env.API_BASE_URL}/api/tickets/partial/${partial}`,
      {
        headers: {
          // Esta ruta está protegida por el secret interno
          'x-internal-secret': process.env.INTERNAL_API_SECRET,
        },
      }
    );
    ticket = resp.data; // { id, … }
  } catch (e) {
    console.error('🔎 Error buscando ticket por parcial', e);
    return ctx.reply(
      `❌ No se encontró ningún ticket cuyo ID empiece por «${partial}».`
    );
  }

  // -------------------------------------------------
  // 3️⃣  Obtener userId del chat (misma lógica que en /estado)
  // -------------------------------------------------
  const chatId = ctx.chat.id;
  let userId = chatUserMap.get(chatId);
  if (!userId) {
    userId = await getUserIdByChatId(chatId);
    if (userId) chatUserMap.set(chatId, userId);
  }

  if (!userId) {
    return ctx.reply(
      '⚠️ Tu cuenta de Telegram no está vinculada. Usa el enlace “Conectar Telegram” desde la app.'
    );
  }

  // -------------------------------------------------
  // 4️⃣  Enviamos el comentario al endpoint interno
  // -------------------------------------------------
  try {
    await axios.post(
      `${process.env.API_BASE_URL}/api/tickets/${ticket.id}/bot-comment`,
      {
        content,
        is_internal: false,
        user_id: userId, // <-- se incluye explícitamente
      },
      {
        headers: {
          'x-internal-secret': process.env.INTERNAL_API_SECRET,
        },
      }
    );

    await ctx.reply('✅ Comentario guardado en el ticket.');
  } catch (err) {
    console.error('❌ Error posting comment via bot', err);
    await ctx.reply('⚠️ No se pudo guardar el comentario.');
  }
});

/* -------------------------------------------------
   Botón inline “✉️ Responder”
   ------------------------------------------------- */
bot.action(/^reply_ticket_(.+)$/, async (ctx) => {
  const ticketId = ctx.match[1];
  const chatId   = ctx.chat.id;

  // Guardamos la ID completa que vino del botón
  pendingReplies.set(chatId, ticketId);
  await ctx.answerCbQuery(); // quita el spinner del botón
  await ctx.reply(
    `📝 Escribe tu respuesta para el ticket #${ticketId} y envíala como mensaje de texto.`
  );
});

/* -------------------------------------------------
   Captura del texto cuando hay una respuesta pendiente
------------------------------------------------- */
bot.on('text', async (ctx,next) => {
  const chatId = ctx.chat.id;
  if (!pendingReplies.has(chatId)) return next(); // nada pendiente

  const ticketId = pendingReplies.get(chatId);
  const answer   = ctx.message.text.trim();

  // obtener userId del chat (igual que en los comandos)
  let userId = chatUserMap.get(chatId);
  if (!userId) {
    userId = await getUserIdByChatId(chatId);
    if (userId) chatUserMap.set(chatId, userId);
  }

  if (!userId) {
    await ctx.reply(
      '⚠️ Tu cuenta de Telegram no está vinculada. Usa el enlace “Conectar Telegram” desde la app.'
    );
    pendingReplies.delete(chatId);
    return;
  }

  try {
    await axios.post(
      `${process.env.API_BASE_URL}/api/tickets/${ticketId}/bot-comment`,
      { content: answer, is_internal: false, user_id: userId }, // <-- user_id incluido
      {
        headers: {
          'x-internal-secret': process.env.INTERNAL_API_SECRET,
        },
      }
    );
    await ctx.reply('✅ Comentario guardado y enviado al ticket.');
  } catch (err) {
    console.error('Error saving answer via bot', err);
    await ctx.reply('⚠️ No se pudo guardar la respuesta.');
  } finally {
    pendingReplies.delete(chatId);
  }
});
/* -------------------  LANZAR EL BOT ------------------- */
(async () => {
  try {
    await bot.launch();                // <-- POLLING (modo por defecto)
    console.log('✅ Bot lanzado en modo POLLING');
  } catch (e) {
    console.error('❌ Error al lanzar el bot', e);
    process.exit(1);
  }
})();

module.exports = {
  bot,
  sendTelegramMessage,
  linkChatInBackend,
  escapeHtml,
  chatIdMessage,
};

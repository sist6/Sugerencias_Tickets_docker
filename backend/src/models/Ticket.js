// src/models/Ticket.js
/**
 * Modelo de Ticket
 *
 * • Implementa soft‑delete (campo `deleted`).
 * • Cambia el estado a **CANCELLED** cuando se marca como eliminado.
 * • La ruta DELETE ahora hace un **hard‑delete** (borrado físico).
 * • Permite actualizar campos whitelist, cambiar estado, añadir comentarios,
 *   asignar, tomar, reabrir, etc.
 */

const { generateId, formatDateForSQL, ensureGuid } = require('../utils/helpers');
const Attachment = require('./Attachment');
const {
  TicketStatus,
  TicketPriority,
  UserRoles,
  Central_ID,
} = require('../utils/constants');
const { sendTelegramMessage,escapeHtml } = require('../bot/telegramBot');
const { getEnabledChatId }    = require('../services/userTelegram.service');
const { executeQuery } = require('../config/db'); // <-- IMPORTANTE
const WsBroadcaster = require('../utils/wsBroadcaster');

/*** -----------------------------------------------------------------
 *  MEMORIA (para tests / modo sin BD)
 * ----------------------------------------------------------------- */
const memoryStore = new Map();

/*** -----------------------------------------------------------------
 *  HELPERS internos (DB / memoria) – asumen que existen
 * ----------------------------------------------------------------- */
function isDBConnected() {
  return typeof executeQuery === 'function';
}

/*** -----------------------------------------------------------------
 *  BUSCAR POR ID (con opción includeDeleted)
 * ----------------------------------------------------------------- */
async function findById(id, { includeDeleted = false } = {}) {
  if (isDBConnected()) {
    ensureGuid('id', id);
    const result = await executeQuery(
      `
      SELECT t.*,
             tt.name AS ticket_type_name,
             h.name  AS hotel_name,
             uc.name AS created_by_name,
             ua.name AS assigned_to_name,
             (
               SELECT tc.id,
                      COALESCE(u.name, 'Usuario eliminado') AS user_name,
                      tc.content,
                      tc.is_internal,
                      tc.created_at
               FROM ticket_comments tc
               LEFT JOIN users u ON tc.user_id = u.id
               WHERE tc.ticket_id = t.id
               ORDER BY tc.created_at ASC
               FOR JSON PATH
             ) AS comments_json
        FROM dbo.tickets t
        LEFT JOIN ticket_types tt ON t.ticket_type_id = tt.id
        LEFT JOIN hotels h        ON t.hotel_id = h.id
        LEFT JOIN users uc       ON t.created_by = uc.id
        LEFT JOIN users ua       ON t.assigned_to = ua.id
       WHERE t.id = @id
         AND ( @includeDeleted = 1 OR t.deleted = 0 )
      `,
      { id, includeDeleted: includeDeleted ? 1 : 0 }
    );
    let ticket = result.recordset[0] || null;
    if (ticket && ticket.comments_json) {
      try {
        ticket.comments = JSON.parse(ticket.comments_json);
      } catch (e) {
        ticket.comments = [];
      }
      delete ticket.comments_json;
    } else if (ticket) {
      ticket.comments = [];
    }
    return ticket;
  } else {
    const ticket = memoryStore.get(id);
    if (!ticket) return null;
    if (!includeDeleted && ticket.deleted) return null;
    return ticket;
  }
}

/*** -----------------------------------------------------------------
 *  CREAR TICKET
 * ----------------------------------------------------------------- */
async function createTicket(data, createdBy) {
  if (!data.title || !data.description || !data.ticket_type_id) {
    throw new Error('Faltan campos obligatorios al crear el ticket');
  }

  const ticket = {
    id: generateId(),
    title: data.title,
    description: data.description,
    ticket_type_id: data.ticket_type_id,
    priority: data.priority || TicketPriority.MEDIUM,
    status: TicketStatus.NEW,
    hotel_id: data.hotel_id || null,
    created_by: createdBy,
    assigned_to: null,
    solution: null,
    deleted: 0,
    created_at: formatDateForSQL(),
    updated_at: formatDateForSQL(),
    resolved_at: null,
    closed_at: null,
  };

  if (isDBConnected()) {
    await executeQuery(
      `
      INSERT INTO tickets (
        id,
        title,
        description,
        ticket_type_id,
        priority,
        status,
        hotel_id,
        created_by,
        assigned_to,
        solution,
        deleted,
        created_at,
        updated_at,
        resolved_at,
        closed_at
      ) VALUES (
        @id,
        @title,
        @description,
        @ticket_type_id,
        @priority,
        @status,
        @hotel_id,
        @created_by,
        @assigned_to,
        @solution,
        @deleted,
        @created_at,
        @updated_at,
        @resolved_at,
        @closed_at
      )
      `,
      ticket
    );

    // Notificaciones a admins/techs (manteniendo comportamiento existente)
    try {
      const userRes = await executeQuery(
        `SELECT id FROM dbo.users WHERE role IN ('admin','technician')`,
        {}
      );
      const adminTechs = (userRes.recordset || []).map((u) => u.id);
      if (adminTechs.length) {
        const Notification = require('./Notification');
        await Promise.all(
          adminTechs.map((uid) =>
            Notification.create({
              user_id: uid,
              title: 'Nuevo ticket creado',
              message: `Se ha creado un nuevo ticket: "${ticket.title}".`,
              type: 'ticket_new',
              link: `/tickets/${ticket.id}`,
            })
          )
        );
      }
    } catch (notiErr) {
      console.error('Error enviando notificaciones de nuevo ticket:', notiErr);
    }

    return ticket;
  } else {
    memoryStore.set(ticket.id, ticket);
    return ticket;
  }
}

/*** -----------------------------------------------------------------
 *  ACTUALIZAR UN TICKET (whitelist)
 * ----------------------------------------------------------------- */

/**
 * Actualiza un ticket.
 *
 * @param {string} id            - GUID del ticket a actualizar.
 * @param {object} updateData   - Campos que se pueden actualizar
 *                                 (lista blanca en `ALLOWED_FIELDS`).
 * @param {object} [user=null]  - Usuario que ejecuta la operación.
 *                                 Sirve para aplicar la regla de negocio:
 *                                 solo ADMIN / TECHNICIAN pueden
 *                                 cancelar tickets asignados a otro
 *                                 usuario.  Cuando `user` es `null`
 *                                 (p.ej. procesos internos) se asume
 *                                 permiso total.
 * @returns {Promise<object|null>}
 */
async function updateTicket(id, updateData, user = null) {
  ensureGuid('id', id);
  const ALLOWED_FIELDS = [
    'title',
    'description',
    'ticket_type_id',
    'priority',
    'status',
    'assigned_to',
    'hotel_id',
    'solution',
    'solution_type_id',
  ];

  const currentTicket = await findById(id);
  if (!currentTicket) return null;

  const updates = { updated_at: formatDateForSQL() };
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updateData, key)) {
      updates[key] = updateData[key];
    }
  }

  if (!Object.prototype.hasOwnProperty.call(updateData, 'assigned_to')) {
    updates.assigned_to = currentTicket.assigned_to ?? null;
  }

  // ---------- lógica de estados ----------
  if (
    updates.status === TicketStatus.RESOLVED &&
    currentTicket.status !== TicketStatus.RESOLVED
  ) {
    updates.resolved_at = formatDateForSQL();
  } else if (
    updates.status === TicketStatus.CLOSED &&
    currentTicket.status !== TicketStatus.CLOSED
  ) {
    updates.closed_at = formatDateForSQL();
  } else if (
    updates.status === TicketStatus.CANCELLED &&
    currentTicket.status !== TicketStatus.CANCELLED
  ) {
    // Cuando se marca como CANCELLED, también lo marcamos como eliminado (soft‑delete)
    updates.deleted = 1;
  }

  // --------------------------------------------------------------
  //  REGLA DE NEGOCIO:
  //  → Usuarios que NO son ADMIN ni TECHNICIAN solo pueden
  //    cancelar (status CLOSED o CANCELLED) tickets que NO estén
  //    asignados (assigned_to === null).
  // --------------------------------------------------------------
  if (
    updates.status === TicketStatus.CLOSED ||
    updates.status === TicketStatus.CANCELLED
  ) {
    // Si se conoce al usuario, verificamos su rol
    if (user && ![UserRoles.ADMIN, UserRoles.TECHNICIAN].includes(user.role)) {
      // Usuario no privilegiado → debe ser ticket sin asignar
      if (currentTicket.assigned_to) {
        throw new Error(
          'No tienes permiso para cancelar un ticket que ya está asignado'
        );
      }
    }
    // Si `user` es null (ej. procesos internos) se asume permiso total.
  }

  const significantChanges = Object.keys(updates).filter((k) => k !== 'updated_at');
  if (significantChanges.length === 0) return currentTicket;

  const setClause = Object.keys(updates)
    .map((col) => `${col} = @${col}`)
    .join(', ');

  /** -------------------------------------------------
   *  1️⃣  ACTUALIZAR la fila en la base (o en memoria)
   * ------------------------------------------------- */
  let updatedTicket;
  if (isDBConnected()) {
    await executeQuery(`UPDATE tickets SET ${setClause} WHERE id = @id`, {
      ...updates,
      id,
    });

    // ---------- NOTIFICACIONES ----------
    const Notification = require('./Notification');

    if (updates.status === TicketStatus.WAITING_RESPONSE) {
      await Notification.create({
        user_id: currentTicket.created_by,
        title: 'Ticket En Espera',
        message: `El ticket "${currentTicket.title}" queda a la espera; cualquier cosa se le notificará.`,
        type: 'ticket_awaiting',
        link: `/tickets/${id}`,
      });
    }

    /* -------------------------------------------------
       NOTIFICACIÓN “ASIGNADO”
       ------------------------------------------------- */
    if (updates.status === TicketStatus.ASSIGNED) {
      // El ID del técnico asignado puede venir en los cambios o estar ya en la tabla.
      const assignedUserId = updates.assigned_to ?? currentTicket.assigned_to;
      if (assignedUserId) {
        await Notification.create({
          user_id: assignedUserId,
          title: 'Ticket Asignado',
          message: `El ticket "${currentTicket.title}" se te ha asignado.`,
          type: 'ticket_assigned',
          link: `/tickets/${id}`,
        });
      }
    }

    /* -------------------------------------------------
       NOTIFICACIÓN “RESUELTO”
       ------------------------------------------------- */
    if (updates.status === TicketStatus.RESOLVED) {
      const targetUser =
        currentTicket.assigned_to || currentTicket.created_by;
      await Notification.create({
        user_id: targetUser,
        title: 'Ticket Resuelto',
        message: `El ticket "${currentTicket.title}" se ha marcado como resuelto.`,
        type: 'ticket_resolved',
        link: `/tickets/${id}`,
      });
    }

    // -------------------------------------------------
    // 2️⃣  OBTENER el ticket actualizado (con relaciones)
    // -------------------------------------------------
    updatedTicket = await findById(id);

    /* -------------------------------------------------
       NOTIFICACIÓN GENÉRICA – *cualquier* otro cambio de estado
       ------------------------------------------------- */
    if (
      updates.status && // se está intentando cambiar el estado
      updates.status !== currentTicket.status // y realmente cambió
    ) {
      // Evitamos duplicar las notificaciones ya enviadas arriba
      const alreadyHandled = [
        TicketStatus.WAITING_RESPONSE,
        TicketStatus.ASSIGNED,
        TicketStatus.RESOLVED,
      ].includes(updates.status);

      if (!alreadyHandled) {
        // Determinamos a quién avisar:
        // - Para CLOSED / CANCELLED notificamos al creador del ticket.
        // - Para los demás estados (IN_PROGRESS, NEW, …) avisamos al técnico asignado
        //   (si lo hay) o al creador como fallback.
        let targetUserId = null;

        if (
          updates.status === TicketStatus.CLOSED ||
          updates.status === TicketStatus.CANCELLED
        ) {
          targetUserId = currentTicket.created_by;
        } else {
          targetUserId =
            currentTicket.assigned_to || currentTicket.created_by;
        }

        if (targetUserId) {
          try {
            await Notification.create({
              user_id: targetUserId,
              title: `Ticket ${updates.status}`,
              message: `El ticket "${currentTicket.title}" cambió a estado **${updates.status}**.`,
              type: 'ticket_status_change',
              link: `/tickets/${id}`,
            });
          } catch (notifErr) {
            // Si la notificación falla no queremos que el propio update del ticket falle.
            console.warn(
              '⚠️  Error al crear notificación genérica de cambio de estado:',
              notifErr
            );
          }
        }
      }
    }
  } else {
    // ── MODO MEMORIA (tests) ────────────────────────────────────────
    const ticket = memoryStore.get(id);
    if (ticket) Object.assign(ticket, updates);
    updatedTicket = await findById(id); // lee de memoria
  }

  /** -------------------------------------------------
   *  3️⃣  BROADCAST WS – notificar a *todos* los clientes
   * ------------------------------------------------- */
  if (updatedTicket) {
    try {
      WsBroadcaster.broadcast({
        type: 'TICKET_UPDATED',
        payload: { ticket: updatedTicket },
      });
    } catch (wsErr) {
      console.warn(
        '⚠️  Error enviando broadcast WS de actualización de ticket',
        wsErr
      );
    }
  }

  // 4️⃣  Devolver el ticket actualizado
  return updatedTicket;
}

/*** -----------------------------------------------------------------
 *  TOMAR TICKET (admin / technician)
 * ----------------------------------------------------------------- */
async function takeTicket(id, userId) {
  if (isDBConnected()) {
    // Sólo se permite tomar tickets con estado NEW o ASSIGNED y que no tengan asignado a nadie.
    ensureGuid('id', id);
    ensureGuid('userId', userId);
    const now = formatDateForSQL();
    const result = await executeQuery(
      `
        UPDATE dbo.tickets
           SET assigned_to = @assigned_to,
               status      = @assigned_status,
               updated_at  = @updated_at
         WHERE id = @id
           AND (status = @new_status OR status = @assigned_status)
           AND assigned_to IS NULL
      `,
      {
        id,
        assigned_to: userId,
        assigned_status: TicketStatus.ASSIGNED,
        new_status: TicketStatus.NEW,
        updated_at: now,
      }
    );

    const rows = result?.rowsAffected?.[0] ?? 0;
    if (rows === 0) {
      throw new Error('Ticket no está disponible para tomar (posible colisión)');
    }
  } else {
    // ── MODO MEMORIA (tests) ────────────────────────────────────────
    const ticket = memoryStore.get(id);
    if (!ticket) throw new Error('Ticket no encontrado');
    if (ticket.assigned_to) {
      throw new Error('Ticket ya está asignado');
    }
    if (![TicketStatus.NEW, TicketStatus.ASSIGNED].includes(ticket.status)) {
      throw new Error('Ticket no está en estado tomable');
    }
    ticket.assigned_to = userId;
    ticket.status = TicketStatus.ASSIGNED;
    ticket.updated_at = now;
  }

  // Devuelve el ticket actualizado (incluye relaciones)
  return findById(id);
}

/*** -----------------------------------------------------------------
 *  REABRIR TICKET
 * ----------------------------------------------------------------- */
async function reopenTicket(id) {
  const ticket = await findById(id);
  if (!ticket) throw new Error('Ticket no encontrado');

  const updates = {
    status: TicketStatus.NEW,
    deleted: 0,
    updated_at: formatDateForSQL(),
    assigned_to: null,
    reopened_count: (ticket.reopened_count || 0) + 1,
    closed_at: null,
    resolved_at: null,
  };

  if (isDBConnected()) {
    await executeQuery(
      `UPDATE tickets
          SET status = @status,
              deleted = @deleted,
              updated_at = @updated_at,
              assigned_to = @assigned_to,
              closed_at = @closed_at,
              resolved_at = @resolved_at,
              reopened_count = @reopened_count
        WHERE id = @id`,
      { ...updates, id }
    );
  } else {
    const t = memoryStore.get(id);
    if (t) Object.assign(t, updates);
  }

  return findById(id);
}

/*** -----------------------------------------------------------------
 *  BORRAR (hard‑delete) – elimina físicamente el registro
 * ----------------------------------------------------------------- */
async function deleteTicket(id) {
  // Hard‑delete: elimina el registro de la tabla.
  if (isDBConnected()) {
    await executeQuery(`DELETE FROM tickets WHERE id = @id`, { id });
  } else {
    memoryStore.delete(id);
  }
  return true;
}

/*** -----------------------------------------------------------------
 *  ADJUNTOS (subida y borrado)
 * @param {string} ticketId
 * @param {Array<File>} files   (array de objetos de multer)
 * @param {string} uploadedBy  (id del usuario)
 * ----------------------------------------------------------------- */
async function uploadAttachment(ticketId, file, uploadedBy) {
  // `file` proviene de Multer (buffer + metadata)
  const att = await Attachment.storeFile({
    entityId: ticketId,
    entity: 'ticket',
    file,
    uploadedBy,
  });

  // Si la tabla `tickets` tiene una columna `attachments` (JSON) no la usamos;
  // devolvemos el ticket actualizado para que el controlador pueda
  // volver a cargar la lista de adjuntos (Ticket.findById ya incluye los
  // adjuntos mediante una JOIN en `Ticket.findById` → opcional)
  const ticket = await findById(ticketId);
  return ticket;
}

/*** -----------------------------------------------------------------
 * BORRAR UN ADJUNTO
 * ----------------------------------------------------------------- */
async function deleteAttachment(attachmentId, user) {
  // user = { sub: id, role: 'admin'|… }
  const isAdmin = user.role === 'admin';
  await Attachment.deleteAttachment(
    attachmentId,
    user.sub,
    isAdmin
  );
}

/*** -----------------------------------------------------------------
 *  AÑADIR UN COMENTARIO (mantiene lógica original)
 * ----------------------------------------------------------------- */
async function addComment(ticketId, commentData, user) {
  const userId = user.sub || user.id;
  const comment = {
    id: generateId(),
    ticket_id: ticketId,
    user_id: userId,
    user_name: user.name,
    content: commentData.content,
    is_internal: commentData.is_internal || false,
    created_at: formatDateForSQL(),
  };

  if (isDBConnected()) {
    await executeQuery(
      `
      INSERT INTO ticket_comments (
        id,
        ticket_id,
        user_id,
        content,
        is_internal,
        created_at
      ) VALUES (
        @id,
        @ticket_id,
        @user_id,
        @content,
        @is_internal,
        @created_at
      )
      `,
      comment
    );
  } else {
    const ticket = memoryStore.get(ticketId);
    if (ticket) {
      ticket.comments = ticket.comments ?? [];
      ticket.comments.push(comment);
      ticket.updated_at = formatDateForSQL();
    }
  }
 /* -------------------------------------------------
   *  NOTIFICACIÓN POR TELEGRAM (solo al otro usuario)
   * ------------------------------------------------- */
   if (!commentData.is_internal) {
    const ticket = await findById(ticketId);          // ticket con sus relaciones
    // ----- ¿A quién le toca notificar? -----
    // Si el autor es el creador → notificar al asignado (si existe)
    // Si el autor es el asignado → notificar al creador
    // Si sólo hay creador (no asignado) → no notificamos (evita bucle)
    let recipientId = null;
    if (userId === ticket.created_by) {
      recipientId = ticket.assigned_to;               // puede ser null → no notifica
    } else {
      recipientId = ticket.created_by;
    }

    if (recipientId) {
      const chatId = await getEnabledChatId(recipientId);
      if (chatId) {
        const safeTitle   = escapeHtml(ticket.title);
        const safeContent = escapeHtml(commentData.content);
        const message = `🗨️ <b>Nuevo comentario</b>\n` +
                        `<b>#${ticket.id}</b> – ${safeTitle}\n\n` +
                        `${safeContent}`;

        await sendTelegramMessage(chatId, {
          title: 'Nuevo comentario',
          message,
          type: 'ticket_comment',          // agrega botón ✉️ Responder
          link: `/tickets/${ticket.id}`,
        });
      }
    }
  }

  // NOTIFICACIÓN DE COMENTARIO EXTERNO
  if (!commentData.is_internal) {
    const ticket = await findById(ticketId);
    const otherUserId =
      user.sub === ticket.created_by ? ticket.assigned_to : ticket.created_by;
    if (otherUserId) {
      const Notification = require('./Notification');
      await Notification.create({
        user_id: otherUserId,
        title: 'Nuevo mensaje en ticket',
        message: `Hay un nuevo comentario en el ticket "${ticket.title}".`,
        type: 'message',
        link: `/tickets/${ticketId}`,
      });
    }
  }
  return await findById(ticketId);
}

/*** -----------------------------------------------------------------
 *  ESTADÍSTICAS DE TICKETS (mantiene lógica original)
 * ----------------------------------------------------------------- */
async function getStats(user) {
  if (isDBConnected()) {
    let whereClause = '1=1';
    const params = {};

    if (user.role === UserRoles.HOTEL_USER) {
      if (user.hotel_ids && user.hotel_ids.length > 0) {
        whereClause = `hotel_id IN (${user.hotel_ids
          .map((_, i) => `@hotel${i}`)
          .join(',')})`;
        user.hotel_ids.forEach((h, i) => (params[`hotel${i}`] = h));
        whereClause += ' AND deleted = 0';
      } else {
        return {
          tickets: {
            total: 0,
            open: 0,
            resolved: 0,
            closed: 0,
            critical: 0,
            high: 0,
          },
        };
      }
    } else if (user.role === UserRoles.CENTRAL_USER) {
      whereClause = 'created_by = @created_by';
      params.created_by = user.id ?? user.sub;
    }

    /* Date filtering for stats */
    let statsWhere = whereClause;
    const statsParams = { ...params };
    if (!statsWhere.includes('WHERE')) {
      statsWhere = 'WHERE 1=1';
    }
    const date_from = params.date_from;
    const date_to = params.date_to;
    // Add date range if provided (consistent with findAll)
    if (date_from) {
      statsWhere += ' AND t.created_at >= @date_from';
      statsParams.date_from = date_from;
    }
    if (date_to) {
      statsWhere += ' AND t.created_at <= @date_to';
      statsParams.date_to = date_to;
    }

    const result = await executeQuery(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('new','assigned','in_progress','waiting_response') THEN 1 ELSE 0 END) as [open],
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN priority = 'critical' AND status NOT IN ('resolved','closed') THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN priority = 'high' AND status NOT IN ('resolved','closed') THEN 1 ELSE 0 END) as high
      FROM dbo.tickets t
      ${statsWhere}`,
      statsParams
    );
    const row = result.recordset[0] || {};
    return {
      tickets: {
        total: row.total || 0,
        open: row.open || 0,
        resolved: row.resolved || 0,
        closed: row.closed || 0,
        critical: row.critical || 0,
        high: row.high || 0,
      },
    };
  } else {
    /* ---------- MEMORIA ---------- */
    let tickets = Array.from(memoryStore.values());

    // ---- RESTRICCIÓN POR ROL ----
    if (user.role === UserRoles.HOTEL_USER) {
      tickets = tickets.filter((t) => user.hotel_ids?.includes(t.hotel_id));
    } else if (user.role === UserRoles.CENTRAL_USER) {
      tickets = tickets.filter(
        (t) => t.created_by === (user.id ?? user.sub)
      );
    }

    // ---- FILTROS EXPLÍCITOS ----
    const openStatuses = [
      'new',
      'assigned',
      'in_progress',
      'waiting_response',
    ];
    return {
      tickets: {
        total: tickets.length,
        open: tickets.filter((t) => openStatuses.includes(t.status)).length,
        resolved: tickets.filter((t) => t.status === 'resolved').length,
        closed: tickets.filter((t) => t.status === 'closed').length,
        critical: tickets.filter(
          (t) =>
            t.priority === 'critical' &&
            !['resolved', 'closed'].includes(t.status)
        ).length,
        high: tickets.filter(
          (t) =>
            t.priority === 'high' &&
            !['resolved', 'closed'].includes(t.status)
        ).length,
      },
    };
  }
}

/*** -----------------------------------------------------------------
 *  BUSCAR TODOS LOS TICKETS (con filtros y control de permisos)
 * ----------------------------------------------------------------- */
async function findAll(filters = {}, user) {
const { status, priority, hotel_id, assigned_to, deleted, date_from, date_to } = filters;

  if (!user) throw new Error('User object required');

  const role = user.role || 'admin';
  const params = {};
  const where = [];

  /* -------------------------------------------------
     USER‑ID FILTER (CAST column to string)
     ------------------------------------------------- */
  if (role === UserRoles.HOTEL_USER) {
    // user_hotels.user_id (uniqueidentifier) → string
    where.push(
      `t.hotel_id IN (
         SELECT hotel_id
         FROM dbo.user_hotels
         WHERE CAST(user_id AS VARCHAR(36)) = @userId
       )`
    );
    params.userId = String(user.id ?? user.sub);
  } else if (role === UserRoles.CENTRAL_USER) {
    // t.created_by (uniqueidentifier) → string
    where.push(`CAST(t.created_by AS VARCHAR(36)) = @userId`);
    params.userId = String(user.id ?? user.sub);
  }

  /* -------------------------------------------------
     OTROS FILTROS (sin cambios)
     ------------------------------------------------- */
  if (status) {
    where.push('t.status = @status');
    params.status = status;
  }
  if (priority) {
    where.push('t.priority = @priority');
    params.priority = priority;
  }
  if (hotel_id) {
    if (Array.isArray(hotel_id)) {
      const placeholders = hotel_id
        .map((_, i) => `@hotelF${i}`)
        .join(', ');
      where.push(`t.hotel_id IN (${placeholders})`);
      hotel_id.forEach((hid, i) => (params[`hotelF${i}`] = hid));
    } else {
      where.push('t.hotel_id = @hotel_id');
      params.hotel_id = hotel_id;
    }
  }

  /* Date range filtering (created_at) */
  if (date_from) {
    where.push('t.created_at >= @date_from');
    params.date_from = date_from;
  }
  if (date_to) {
    where.push('t.created_at <= @date_to');
    params.date_to = date_to;
  }
  if (assigned_to) {
    if (assigned_to === '_unassigned') {
      where.push('t.assigned_to IS NULL');
    } else {
      // Cast column, just in case the param comes as number
      where.push('CAST(t.assigned_to AS VARCHAR(36)) = @assigned_to');
      params.assigned_to = String(assigned_to);
    }
  }
  if (deleted !== undefined) {
    const wantDeleted =
      deleted === true || deleted === 'true' || deleted === 1;
    where.push(`t.deleted = ${wantDeleted ? 1 : 0}`);
  } else {
    where.push('t.deleted = 0');
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `
    SELECT
      t.*,
      tt.name AS ticket_type_name,
      h.name AS hotel_name,
      uc.name AS created_by_name,
      ua.name AS assigned_to_name
    FROM dbo.tickets t
    LEFT JOIN ticket_types tt ON t.ticket_type_id = tt.id
    LEFT JOIN hotels h        ON t.hotel_id = h.id
    LEFT JOIN users uc       ON t.created_by = uc.id
    LEFT JOIN users ua       ON t.assigned_to = ua.id
    ${whereClause}
    ORDER BY
      t.created_at DESC
  `;

  const result = await executeQuery(sql, params);
  return result.recordset;
}

/*** -----------------------------------------------------------------
 *  EXPORTACIÓN
 * ----------------------------------------------------------------- */
module.exports = {
  createTicket,
  findById,
  findAll,
  updateTicket,
  addComment,
  takeTicket,
  reopenTicket,
  deleteTicket, // <-- hard‑delete now
  getStats,
  uploadAttachment,
  deleteAttachment,
};

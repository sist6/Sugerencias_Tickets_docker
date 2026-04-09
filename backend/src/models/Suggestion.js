// src/models/Suggestion.js
/**
 * Modelo de Propuesta
 * Tabla: suggestions
 */

const { generateId, formatDateForSQL } = require('../utils/helpers');
const { isDBConnected, executeQuery } = require('../config/db');
const Attachment = require('./Attachment');
const { SuggestionStatus } = require('../utils/constants');

const store = new Map();

/* ---------- UTILIDADES ---------- */
function toDbRow(sug) {
  return {
    id: sug.id,
    title: sug.title,
    description: sug.description,
    benefits: sug.benefits || '',
    status: sug.status,
    created_by: sug.created_by,
    assigned_to: sug.assigned_to || null,
    project_id: sug.project_id || null,
    cancellation_reason: sug.cancellation_reason || null,
    created_at: sug.created_at,
    updated_at: sug.updated_at,
  };
}

/* -------------------------------------------------
   READ – BÚSQUEDA GENERAL (con filtros)
   ------------------------------------------------- */
async function findAll(filters = {}) {
  if (isDBConnected()) {
    let where = '1=1';
    const params = {};

    if (filters.status) {
      where += ' AND status = @status ';
      params.status = filters.status;
    }
    if (filters.created_by) {
      where += ' AND created_by = @created_by';
      params.created_by = filters.created_by;
    }

    const result = await executeQuery(
      `SELECT * FROM suggestions WHERE ${where} ORDER BY created_at DESC`,
      params
    );
    return result.recordset;
  }

  // ---- MODO MEMORIA ----
  let arr = Array.from(store.values());
  if (filters.status) arr = arr.filter((s) => s.status === filters.status);
  if (filters.created_by)
    arr = arr.filter((s) => s.created_by === filters.created_by);
  return arr;
}

/* -------------------------------------------------
   CREATE – Crear una nueva sugerencia
   ------------------------------------------------- */
async function create(data, creatorId) {
  const sug = {
    id: generateId(),
    title: data.title,
    description: data.description,
    benefits: data.benefits || '',
    status: SuggestionStatus.NEW,
    created_by: creatorId,
    assigned_to: data.assigned_to || null,
    project_id: data.project_id || null,
    cancellation_reason: null,
    created_at: formatDateForSQL(),
    updated_at: formatDateForSQL(),
  };

  if (isDBConnected()) {
    await executeQuery(
      `INSERT INTO suggestions
        (id, title, description, benefits, status, created_by,
         assigned_to, project_id, cancellation_reason, created_at, updated_at)
       VALUES
        (@id, @title, @description, @benefits, @status, @created_by,
         @assigned_to, @project_id, @cancellation_reason, @created_at, @updated_at)`,
      toDbRow(sug)
    );

    /* ---------- NOTIFICAR A ADMIN / TECH (nueva sugerencia) ---------- */
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
              title: 'Nueva sugerencia creada',
              message: `Se ha creado una nueva sugerencia: "${sug.title}".`,
              type: 'suggestion_new',
              link: `/suggestions/${sug.id}`,
            })
          )
        );
      }
    } catch (notiErr) {
      console.error(
        '⚠️  Error enviando notificaciones de nueva sugerencia:',
        notiErr
      );
    }
  } else {
    // MODO MEMORIA
    store.set(sug.id, sug);
  }

  return sug;
}

/* -------------------------------------------------
   UPDATE – Actualizar campos de una sugerencia
   ------------------------------------------------- */
async function update(id, data) {
  // ==============================================================
  // 1️⃣  CARGAR LA SUGERENCIA ANTERIOR (para saber cambios)
  // ==============================================================

  const previous = await findById(id);
  if (!previous) throw new Error('Sugerencia no encontrada');

  // ==============================================================
  // 2️⃣  CONSTRUIR EL UPDATE (solo los campos recibidos)
  // ==============================================================

  const set = [];
  const params = { id };

  if (data.title !== undefined) {
    set.push('title = @title');
    params.title = data.title;
  }
  if (data.description !== undefined) {
    set.push('description = @description');
    params.description = data.description;
  }
  if (data.benefits !== undefined) {
    set.push('benefits = @benefits');
    params.benefits = data.benefits;
  }
  if (data.status !== undefined) {
    set.push('status = @status');
    params.status = data.status;
  }
  if (data.assigned_to !== undefined) {
    set.push('assigned_to = @assigned_to');
    params.assigned_to = data.assigned_to;
  }
  if (data.project_id !== undefined) {
    set.push('project_id = @project_id');
    params.project_id = data.project_id;
  }
  if (data.cancellation_reason !== undefined) {
    set.push('cancellation_reason = @cancellation_reason');
    params.cancellation_reason = data.cancellation_reason;
  }

  if (set.length === 0) {
    // nada que cambiar → devolvemos la sugerencia tal cual
    return previous;
  }

  set.push('updated_at = @updated_at');
  params.updated_at = formatDateForSQL();

  if (isDBConnected()) {
    await executeQuery(
      `UPDATE suggestions SET ${set.join(', ')} WHERE id = @id`,
      params
    );
  } else {
    // MODO MEMORIA
    const sug = store.get(id);
    if (sug) {
      Object.assign(sug, {
        ...data,
        updated_at: params.updated_at,
      });
    }
  }

  // ==============================================================
  // 3️⃣  OBTENER LA SUGERENCIA ACTUALIZADA
  // ==============================================================

  const updated = await findById(id);

  // ==============================================================
  // 4️⃣  NOTIFICACIONES según cambio de estado
  // ==============================================================

  // Sólo notificamos si el **estado** cambió
  if (data.status && data.status !== previous.status) {
    const Notification = require('./Notification');

    // ---------- CANCELADA ----------
    if (data.status === SuggestionStatus.CANCELLED) {
      // Notificamos al creador (y al asignado si lo hubiera)
      const targets = new Set([previous.created_by]);
      if (previous.assigned_to) targets.add(previous.assigned_to);

      await Promise.all(
        Array.from(targets).map((uid) =>
          Notification.create({
            user_id: uid,
            title: 'Sugerencia cancelada',
            message: `La sugerencia "${previous.title}" ha sido cancelada.`,
            type: 'suggestion_suspended',
            link: `/suggestions/${id}`,
          })
        )
      );
    }

    // ---------- RESUELTA ----------
    if (data.status === SuggestionStatus.IN_DEVELOPMENT) {
      // Si tiene asignado, le notificamos a él; si no, al creador.
      const targetUser = previous.created_by;
      await Notification.create({
        user_id: targetUser,
        title: 'Sugerencia Aprobada',
        message: `La sugerencia "${previous.title}" se ha marcado como aprobada y se encuentra en desarrollo.`,
        type: 'suggestion_approved',
        link: `/suggestions/${id}`,
      });
    }
  }

  // ==============================================================
  // 5️⃣  Devolver la sugerencia actualizada
  // ==============================================================

  return updated;
}

/* -------------------------------------------------
   DELETE – Borrar una sugerencia (hard‑delete)
   ------------------------------------------------- */
async function remove(id) {
  if (isDBConnected()) {
    await executeQuery(`DELETE FROM suggestions WHERE id = @id`, { id });
  } else {
    store.delete(id);
  }
}

/* -------------------------------------------------
   FIND BY PROJECT – Todas las sugerencias de un proyecto
   ------------------------------------------------- */
async function findByProjectId(projectId) {
  if (isDBConnected()) {
    const result = await executeQuery(
      `SELECT * FROM suggestions WHERE project_id = @projectId ORDER BY created_at DESC`,
      { projectId }
    );
    return result.recordset; // siempre array (puede estar vacío)
  }

  // fallback MEMORIA
  return Array.from(store.values()).filter(
    (s) => s.project_id && s.project_id === projectId
  );
}
/* -----------------------------------------------------------------
   ATTACHMENTS – Subir / Borrar archivos en una sugerencia
   ----------------------------------------------------------------- */
async function uploadAttachment(suggestionId, file, uploadedBy) {
  // Guardamos el BLOB y devolvemos el registro con la URL `/attachments/<id>`
  const att = await Attachment.storeFile({
    entityId: suggestionId,
    entity: 'suggestion',
    file,
    uploadedBy,
  });

  // Refrescamos la sugerencia para que tenga la lista de adjuntos actualizada
  return findById(suggestionId);
}

/**
 * Borra un archivo adjunto.
 *
 * @param {string} attachmentId
 * @param {Object} user  → { sub: userId, role: 'admin' | … }
 */
async function deleteAttachment(attachmentId, user) {
  const isAdmin = user.role === 'admin';
  await Attachment.deleteAttachment(attachmentId, user.sub, isAdmin);

  // Obtener el ID de la sugerencia a la que pertenecía el adjunto.
  const res = await executeQuery(
    `SELECT suggestion_id FROM attachments WHERE id = @id`,
    { id: attachmentId }
  );
  const suggestionId = res.recordset[0]?.suggestion_id;
  if (suggestionId) return findById(suggestionId);
  return null;
}

/* -------------------------------------------------
   FIND BY ID – Con datos de creador/asignado y adjuntos
   ------------------------------------------------- */
async function findById(id) {
  if (isDBConnected()) {
    const result = await executeQuery(
      `SELECT
         s.*,
         cu.name AS created_by_name,
         au.name AS assigned_to_name
       FROM suggestions s
       LEFT JOIN users cu ON s.created_by = cu.id
       LEFT JOIN users au ON s.assigned_to = au.id
       WHERE s.id = @id`,
      { id }
    );
    const sug = result.recordset[0] || null;
    if (!sug) return null;

    // Adjuntos (siempre los cargamos; la ruta de autorización está en la capa HTTP)
    sug.attachments = await Attachment.listBySuggestion(id);
    return sug;
  }

  // MODO MEMORIA
  const sug = store.get(id) || null;
  if (sug) sug.attachments = sug.attachments ?? [];
  return sug;
}

/* ---------------------- EXPORT ---------------------- */
module.exports = {
  findAll,
  findById,
  create,
  update,
  delete: remove,
  uploadAttachment,
  deleteAttachment,
  findByProjectId,
};

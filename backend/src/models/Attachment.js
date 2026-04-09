// src/models/Attachment.js
/**
 *   Gestión centralizada de los adjuntos.
 *
 *   - Guarda el archivo en la tabla `attachments` como BLOB.
 *   - Devuelve los metadatos + URL para descarga.
 *   - Permite listar adjuntos de tickets o sugerencias.
 */

const { executeQuery } = require('../config/db');
const { generateId, formatDateForSQL } = require('../utils/helpers');
const { isDBConnected } = require('../config/db');

/**
 * Guarda un archivo en la base de datos.
 *
 * @param {Object} opts
 *   - entityId   : id del ticket o sugerencia
 *   - entity    : 'ticket' | 'suggestion'   (se usa para la FK)
 *   - file      : objeto File de multer (con buffer, originalname, mimetype, size)
 *   - uploadedBy: id de usuario que sube el archivo
 *
 * @returns {Object} el registro creado (incluye `url` para descarga)
 */
async function storeFile({ entityId, entity, file, uploadedBy }) {
  if (!['ticket', 'suggestion'].includes(entity))
    throw new Error('entity must be ticket or suggestion');

  const columnFk = entity === 'ticket' ? 'ticket_id' : 'suggestion_id';

  const record = {
    id: generateId(),
    [columnFk]: entityId,
    filename: file.originalname,
    mime_type: file.mimetype,
    size_bytes: file.size,
    blob_data: file.buffer,               // <-- BLOB
    url: null,                            // mantemos para compatibilidad
    uploaded_by: uploadedBy,
    uploaded_at: formatDateForSQL(),
  };

  const sql = `
    INSERT INTO attachments
      (id, ${columnFk}, filename, mime_type, size_bytes,
       blob_data, url, uploaded_by, uploaded_at)
    VALUES
      (@id, @entityId, @filename, @mime_type, @size_bytes,
       @blob_data, @url, @uploaded_by, @uploaded_at)
  `;

  await executeQuery(sql, {
    id: record.id,
    entityId,
    filename: record.filename,
    mime_type: record.mime_type,
    size_bytes: record.size_bytes,
    blob_data: record.blob_data,
    url: record.url,
    uploaded_by: record.uploaded_by,
    uploaded_at: record.uploaded_at,
  });

  // Construimos la URL pública (la usaremos en el front‑end)
  record.url = `/attachments/${record.id}`;
  return record;
}

/**
 * Obtiene un adjunto (incluido el BLOB).
 *
 * @param {string} id  UUID del registro
 * @returns {Object|null}
 */
async function getById(id) {
  const res = await executeQuery(
    `SELECT id, filename, mime_type, size_bytes, blob_data, url 
       FROM attachments 
      WHERE id = @id`,
    { id }
  );
  const att = res.recordset[0];
  if (!att) return null;
  // Enviamos la URL de descarga aunque la columna `url` sea NULL.
  att.url = `/attachments/${att.id}`;
  return att;
}

/**
 * Lista los adjuntos de una sugerencia.
 *
 * @param {string} suggestionId
 * @returns {Array}
 */
async function listBySuggestion(suggestionId) {
  const res = await executeQuery(
    `SELECT id, filename, mime_type, size_bytes, url
       FROM attachments
      WHERE suggestion_id = @sid`,
    { sid: suggestionId }
  );
  // Añadimos la URL de descarga para cada fila.
  return res.recordset.map((a) => ({
    ...a,
    url: `/attachments/${a.id}`,
  }));
}

/**
 * Lista los adjuntos de un ticket.
 *
 * @param {string} ticketId
 * @returns {Array}
 */
async function listByTicket(ticketId) {
  const res = await executeQuery(
    `SELECT id, filename, mime_type, size_bytes, url
       FROM attachments
      WHERE ticket_id = @tid`,
    { tid: ticketId }
  );
  return res.recordset.map((a) => ({
    ...a,
    url: `/attachments/${a.id}`,
  }));
}

/**
 * Borrado físico del adjunto.
 *
 * @param {string} attachmentId
 * @param {string} userId   (para auditoría)
 * @param {boolean} isAdmin
 */
async function deleteAttachment(attachmentId, userId, isAdmin = false) {
  // Sólo admins o el usuario que subió el archivo pueden borrar.
  const canDelete = isAdmin
    ? true
    : await executeQuery(
        `SELECT 1 FROM attachments WHERE id = @id AND uploaded_by = @uid`,
        { id: attachmentId, uid: userId }
      ).then((r) => r.recordset.length > 0);

  if (!canDelete) throw new Error('No tiene permisos para borrar este archivo');

  await executeQuery(`DELETE FROM attachments WHERE id = @id`, {
    id: attachmentId,
  });
  return true;
}

/* ----------------------------------------------------------------- */
module.exports = {
  storeFile,
  getById,
  listBySuggestion,
  listByTicket,
  deleteAttachment,
};

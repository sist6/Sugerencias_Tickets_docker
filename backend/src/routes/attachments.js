// src/routes/attachments.js
/* --------------------------------------------------------------
   RUTAS DE ADJUNTOS (tickets y suggestions) – BLOB en DB
   -------------------------------------------------------------- */
const { Router } = require('express');
const multer = require('multer');

const Ticket      = require('../models/Ticket');
const Suggestion  = require('../models/Suggestion');
const Attachment  = require('../models/Attachment');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { body } = require('express-validator');
const router = Router();

/* -----------------------------------------------------------------
   0️⃣  CONFIGURACIÓN DE MULTER – memoria (no disco)
   ----------------------------------------------------------------- */
const upload = multer({
  storage: multer.memoryStorage(),               // <-- todo en RAM
  limits: { fileSize: 10 * 1024 * 1024 },       // 10 MiB máximo por archivo
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/html',
      // videos (cualquier tipo que empiece por video/)
      // imágenes (cualquier tipo que empiece por image/)
    ];

    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    const ok = allowed.includes(file.mimetype) || isImage || isVideo;

    if (ok) cb(null, true);
    else cb(new Error('Tipo de archivo no permitido'), false);
  },
});
/* ----------------------------------------------------------------- */

/* ==============================================================
   1️⃣  SUBIR ADJUNTO A UN TICKET
   ============================================================== */
router.post(
  '/tickets/:id/attachments',
  authenticateToken,
  upload.array('file'),                 // permite varios archivos
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No se recibió ningún archivo' });
      }

      const ticketId = req.params.id;
      const ticket   = await Ticket.findById(ticketId);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

      // Guardamos cada archivo y vamos devolviendo el último creado.
      let lastAttachment = null;
      for (const file of req.files) {
        // Ticket.uploadAttachment delega a Attachment.storeFile
        const updatedTicket = await Ticket.uploadAttachment(
          ticketId,
          file,               // <-- Buffer + metadata
          req.user.sub        // id del usuario autenticado
        );
        lastAttachment = updatedTicket.attachments?.slice(-1)[0];
      }

      res.status(201).json(lastAttachment);
    } catch (err) {
      next(err);
    }
  }
);

/* ==============================================================
   2️⃣  LISTAR ADJUNTOS DE UN TICKET
   ============================================================== */
router.get(
  '/tickets/:id/attachments',
  authenticateToken,
  async (req, res, next) => {
    try {
      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

      const userId = req.user.sub;
      const role   = req.user.role;

      const canView =
        role === 'admin' ||
        role === 'technician' ||
        ticket.created_by === userId ||
        ticket.assigned_to === userId;

      if (!canView) {
        return res
          .status(403)
          .json({ detail: 'No tienes permiso para ver los archivos de este ticket' });
      }

      // Cada adjunto incluye `url: /attachments/<id>`
      res.json(ticket.attachments ?? []);
    } catch (err) {
      next(err);
    }
  }
);

/* ==============================================================
   3️⃣  SUBIR ADJUNTO A UNA SUGERENCIA
   ============================================================== */
router.post(
  '/suggestions/:id/attachments',
  authenticateToken,
  upload.array('file'),                 // permite varios archivos
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No se recibió ningún archivo' });
      }

      const sugId = req.params.id;
      const suggestion = await Suggestion.findById(sugId);
      if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

      let lastAttachment = null;
      for (const file of req.files) {
        const updatedSug = await Suggestion.uploadAttachment(
          sugId,
          file,
          req.user.sub
        );
        lastAttachment = updatedSug.attachments?.slice(-1)[0];
      }

      res.status(201).json(lastAttachment);
    } catch (err) {
      next(err);
    }
  }
);

/* ==============================================================
   4️⃣  LISTAR ADJUNTOS DE UNA SUGERENCIA
   ============================================================== */
router.get(
  '/suggestions/:id/attachments',
  authenticateToken,
  async (req, res, next) => {
    try {
      const suggestion = await Suggestion.findById(req.params.id);
      if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

      const userId = req.user.sub;
      const role   = req.user.role;

      // ----- REGLAS DE VISIBILIDAD -----
      let canView = false;

      if (role === 'admin' || role === 'technician') {
        canView = true;
      } else if (role === 'central_user' || role === 'hotel_user') {
        // Sólo sus propias propuestas (creadas o asignadas)
        canView = suggestion.created_by === userId || suggestion.assigned_to === userId;
      }

      if (!canView) {
        return res
          .status(403)
          .json({ detail: 'No tienes permiso para ver los archivos de esta propuesta' });
      }

      res.json(suggestion.attachments ?? []);
    } catch (err) {
      next(err);
    }
  }
);

/* ==============================================================
   5️⃣  ELIMINAR UN ADJUNTO (tickets o suggestions)
   ============================================================== */
router.delete(
  '/attachments/:id',
  authenticateToken,
  async (req, res, next) => {
    try {
      // El modelo gestiona autorización (admin o uploader)
      await Attachment.deleteAttachment(req.params.id, req.user.sub, req.user.role === 'admin');
      // 204 No Content – éxito sin cuerpo
      res.status(204).send();
    } catch (err) {
      // Si el modelo lanzó un error con `status`, lo devolvemos tal cual
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  }
);

/* ==============================================================
   6️⃣  DESCARGAR UN ADJUNTO (BLOB desde la BD)
   ============================================================== */
router.get(
  '/attachments/:id',
  authenticateToken,
  async (req, res, next) => {
    try {
      const attachment = await Attachment.getById(req.params.id);
      if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

      const userId = req.user.sub;
      const role   = req.user.role;

      // --------- 1️⃣  Determinar a qué entidad pertenece ----------
      let canView = false;

      if (attachment.ticket_id) {
        const ticket = await Ticket.findById(attachment.ticket_id);
        canView =
          role === 'admin' ||
          role === 'technician' ||
          ticket.created_by === userId ||
          ticket.assigned_to === userId;
      } else if (attachment.suggestion_id) {
        const suggestion = await Suggestion.findById(attachment.suggestion_id);
        canView =
          role === 'admin' ||
          role === 'technician' ||
          suggestion.created_by === userId ||
          suggestion.assigned_to === userId;
      }

      if (!canView) {
        return res.status(403).json({ detail: 'No tienes permiso para descargar este archivo' });
      }

      // --------- 2️⃣  Enviar el BLOB ---------
      // `blob_data` es un Buffer con el contenido binario.
      res.setHeader('Content-Type', attachment.mime_type);
      // Forzar descarga con el nombre original
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${attachment.filename}"`
      );
      // `attachment.blob_data` puede ser `null` (en caso de datos antiguos)
      // En tal caso devolvemos 410 Gone.
      if (!attachment.blob_data) {
        return res.status(410).json({ error: 'El contenido del archivo no está disponible' });
      }

      res.send(attachment.blob_data);
    } catch (err) {
      next(err);
    }
  }
);

/* -------------------------------------------------------------
   EXPORTAMOS EL ROUTER
   ------------------------------------------------------------- */
module.exports = router;

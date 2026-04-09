// src/routes/tickets.routes.js
const { Router } = require('express');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { isValidUUID } = require('../utils/helpers');
const { requireRoles } = require('../middleware/roles');
const {
  UserRoles,
  TicketStatus,
  TicketPriority,
  Central_ID,
} = require('../utils/constants');
const {executeQuery} = require('../config/db');
const router = Router();
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticateInternal } = require('../middleware/authenticateInternal');

/* ---------- LISTADO ---------- */
router.get(
  '/tickets',
  authenticateToken,
  async (req, res, next) => {
    try {
      const user = {
        ...req.user,
        id: req.user.id ?? req.user.sub,
      };

      const filters = {
        status: req.query.status,
        priority: req.query.priority,
        hotel_id:
          user.role === UserRoles.CENTRAL_USER
            ? req.query.hotel_id || Central_ID
            : null,
        assigned_to: req.query.assigned_to,
        deleted: req.query.deleted,
      };

      const tickets = await Ticket.findAll(filters, user);
      res.json(tickets);
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- DETALLE ---------- */
router.get(
  '/tickets/:id([0-9a-fA-F-]{36})',   // ← regex de Express
  authenticateToken,
  async (req, res, next) => {
    try {
      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) {
        return res.status(404).json({
          error: `Ticket ${req.params.id} no encontrado`,
        });
      }
      res.json(ticket);
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- CREAR ---------- */
router.post(
  '/tickets',
  authenticateToken,
  validate([
    body('title').isString().isLength({ min: 1, max: 255 }).trim(),
    body('description').isString().trim(),
    body('ticket_type_id').isUUID(),
    body('priority').optional().isIn(Object.values(TicketPriority)).withMessage('Prioridad no válida'),
    body('hotel_id').optional().isUUID(),
  ]),
  async (req, res, next) => {
    try {
      const ticket = await Ticket.createTicket(req.body, req.user.sub);
      res.status(201).json(ticket);
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- ACTUALIZAR (control de permisos) ---------- */
router.put(
  '/tickets/:id',
  authenticateToken,
   validate([
    param('id').isUUID(),
    body('status').optional().isIn(Object.values(TicketStatus)).withMessage('Estado no válido'),
    body('priority').optional().isIn(Object.values(TicketPriority)).withMessage('Prioridad no válida'),
    body('assigned_to').optional().isUUID(),
   ]),
  async (req, res, next) => {
    try {
      const user = { ...req.user, id: req.user.id ?? req.user.sub };
      const role = user.role || 'admin';

      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

      // ADMIN / TECHNICIAN → pueden actualizar cualquier campo
     if (role === UserRoles.ADMIN || role === UserRoles.TECHNICIAN) {
        // ADMIN / TECHNICIAN pueden actualizar cualquier campo → pasamos el usuario
        const updated = await Ticket.updateTicket(
          req.params.id,
          req.body,
          user
        );
         return res.json(updated);
      }

      // Resto de usuarios → solo pueden **cancelar** si el ticket NO está tomado
      const allowedFields = ['status'];
      const bodyKeys = Object.keys(req.body);
      const onlyAllowed = bodyKeys.every((k) => allowedFields.includes(k));

      if (!onlyAllowed) {
        return res
          .status(403)
          .json({ error: 'Operación no permitida para este rol' });
      }

      // Debe ser un request de cancelación
      //if (req.body.status !== TicketStatus.CANCELLED) {
        //return res
          //.status(403)
          //.json({ error: 'Solo se permite cambiar a estado "cancelled"' });
      //}

      // No debe estar asignado a nadie
      if (ticket.assigned_to) {
        return res
          .status(403)
          .json({ error: 'El ticket ya está tomado; no se puede cancelar' });
      }

      const updated = await Ticket.updateTicket(
          req.params.id,
          { status: TicketStatus.CLOSED },
          user
        );
      return res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- AÑADIR COMENTARIO ---------- */
router.post(
  '/tickets/:id/comments',
  authenticateToken,
  async (req, res, next) => {
    try {
      const ticket = await Ticket.addComment(req.params.id, req.body, req.user);
      res.json(ticket);
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- ASIGNAR (admin / technician) ---------- */

router.post(
  '/tickets/:id/assign',
  authenticateToken,
  async (req, res, next) => {
    try {
      const ticketId = req.params.id;
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

      const userRole = req.user.role;
      if (userRole === UserRoles.ADMIN) {
        // ok
      } else if (userRole === UserRoles.TECHNICIAN) {
        if (ticket.assigned_to !== req.user.sub) {
          return res.status(403).json({
            detail: 'Los técnicos solo pueden reasignar tickets que les pertenecen',
          });
        }
      } else {
        return res.status(403).json({ detail: 'Permisos insuficientes' });
      }

      const rawAssigneeId = req.body?.assignee_id ?? req.query?.assignee_id;

      // ---- VALIDACIÓN ----
      const normalizedAssigneeId =
        rawAssigneeId && rawAssigneeId !== '_unassigned'
          ? String(rawAssigneeId)
          : null;

      if (normalizedAssigneeId && !isValidUUID(normalizedAssigneeId)) {
        return res.status(400).json({
          detail: 'El ID del técnico no tiene formato GUID',
        });
      }

      const updatedTicket = await Ticket.updateTicket(ticketId, {
        assigned_to: normalizedAssigneeId,
      });

      res.json(updatedTicket);
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- TOMAR (admin / technician) ---------- */
router.post(
  '/tickets/:id/take',
  authenticateToken,
  requireRoles(['admin', 'technician']),
  async (req, res, next) => {
    try {
      const ticketId = req.params.id;
      const userId = req.user.sub;

      // VALIDAR GUID del usuario (por si el JWT contiene un número)
      if (!isValidUUID(userId)) {
        return res.status(400).json({ detail: 'El ID del usuario no es GUID' });
      }

      const ticket = await Ticket.takeTicket(ticketId, userId);

      // Notificación vía WS (TicketWatcher)
      if (global.watcher && typeof global.watcher.notifyTicketTaken === 'function') {
        await global.watcher.notifyTicketTaken(ticket.id);
      }

      res.json(ticket);
    } catch (err) {
      if (err.message?.includes('no está disponible')) {
        return res.status(409).json({ error: err.message });
      }
      next(err);
    }
  }
);

router.get(
  '/tickets/metadata',
  authenticateToken,
  async (req, res, next) => {
    try {
      // Simplemente usamos la tabla y sacamos MAX(updated_at)
      const result = await executeQuery(
        `SELECT MAX(updated_at) AS last_modified FROM dbo.tickets`,
        {}
      );
      const lastModified = result.recordset[0]?.last_modified;
      // Generamos una versión (timestamp milisegundos)
      const version = new Date(lastModified).getTime();
      res.json({ version, lastModified });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- REABRIR ---------- */
router.post(
  '/tickets/:id/reopen',
  authenticateToken,
  async (req, res, next) => {
    try {
      const ticket = await Ticket.reopenTicket(req.params.id);
      res.json(ticket);
    } catch (err) {
      next(err);
    }
  }
);

router.post('/tickets/:id/bot-comment', authenticateInternal, async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { content, is_internal = false, user_id } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });
    const commentUser = await User.findById(user_id);
    if (!commentUser) return res.status(404).json({ error: 'User not found' });

    await Ticket.addComment(ticketId, { content, is_internal }, commentUser);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------
//  Cambio de estado enviado desde el bot (ahora con user_id)
// -----------------------------------------------------------------
router.patch(
  '/tickets/:id/bot-status',
  authenticateInternal,
  async (req, res, next) => {
    try {
      const ticketId = req.params.id;
      const {
        status,
        solution_type_id,
        solution,
        user_id,
      } = req.body; // user_id es opcional (el bot siempre lo envía)

      // -----------------------------------------------------------------
      // 1️⃣  Validaciones básicas del estado
      // -----------------------------------------------------------------
      if (!status) return res.status(400).json({ error: 'status required' });
      const allowed = Object.values(TicketStatus);
      if (!allowed.includes(status))
        return res.status(400).json({ error: 'invalid status' });

      // -----------------------------------------------------------------
      // 2️⃣  Si el nuevo estado es RESUELTO, exigimos los campos extra
      // -----------------------------------------------------------------
      if (status === TicketStatus.RESOLVED) {
        if (!solution_type_id)
          return res
            .status(400)
            .json({ error: 'solution_type_id required for resolved status' });
        if (!solution || typeof solution !== 'string' || !solution.trim())
          return res
            .status(400)
            .json({ error: 'solution description required for resolved status' });
      }

      // -----------------------------------------------------------------
      // 3️⃣  Determinar quién está “actualizando” el ticket
      // -----------------------------------------------------------------
      let updater;
      if (user_id) {
        updater = await User.findById(user_id);
        if (!updater) {
          return res.status(404).json({ error: 'User not found' });
        }
      }

      // -----------------------------------------------------------------
      // 4️⃣  Construir objeto de actualización
      // -----------------------------------------------------------------
      const updatePayload = { status };
      if (status === TicketStatus.RESOLVED) {
        updatePayload.solution_type_id = solution_type_id;
        updatePayload.solution = solution;
      }

      // -----------------------------------------------------------------
      // 5️⃣  Ejecutar la actualización
      // -----------------------------------------------------------------
      const updated = await Ticket.updateTicket(ticketId, updatePayload, updater);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);
/* ----------------------BOT STATUS----------------* */

router.patch('/:id/bot-status',
  authenticateInternal,
  async (req, res, next) => {
    try {
      const { status } = req.body;          // debe ser uno de TicketStatus
      if (!status) return res.status(400).json({ error: 'status required' });

      const allowed = Object.values(TicketStatus);
      if (!allowed.includes(status))
        return res.status(400).json({ error: 'invalid status' });

      // Ticket.updateStatus() es tu método que hace el UPDATE y devuelve el ticket actualizado
      const updated = await Ticket.updateStatus(req.params.id, status);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });


/* ---------- BORRAR (hard‑delete) ---------- */
router.delete(
  '/tickets/:id',
  authenticateToken,
  requireRoles(['admin','technician']),
  async (req, res, next) => {
    try {
      // Hard‑delete, elimina físicamente el registro
      await Ticket.deleteTicket(req.params.id);
      res.json({ message: 'Ticket eliminado de forma permanente' });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- ESTADÍSTICAS ---------- */
router.get(
  '/dashboard/stats',
  authenticateToken,
  async (req, res, next) => {
    try {
      const stats = await Ticket.getStats(req.user);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

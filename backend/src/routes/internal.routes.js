// src/routes/internal.routes.js
const { Router } = require('express');
const { botSaveChatId } = require('../controllers/userTelegram.controller');
const { authenticateInternal } = require('../middleware/authenticateInternal');
const Ticket = require('../models/Ticket');
const User   = require('../models/User');
const { TicketStatus, UserRoles } = require('../utils/constants');
const { executeQuery } = require('../config/db');

const router = Router();

/* -----------------------------------------------------------------
   ENLACE DE CHAT – ya existía
   ----------------------------------------------------------------- */
router.post('/users/:id/telegram', authenticateInternal, botSaveChatId);

/* -----------------------------------------------------------------
   1️⃣  5 tickets sin asignar
   ----------------------------------------------------------------- */
router.get('/tickets/unassigned', authenticateInternal, async (req, res, next) => {
  try {
    // Ticket.findAll necesita un “user” (solo para la firma); usamos un dummy admin.
    const tickets = await Ticket.findAll(
      {
        assigned_to: '_unassigned',   // WHERE assigned_to IS NULL
        deleted: false,
      },
      { role: 'admin' }
    );

    // Limitamos a 5 (los más recientes)
    const limited = tickets.slice(0, 5);
    res.json(limited);
  } catch (err) {
    next(err);
  }
});

/* -----------------------------------------------------------------
   2️⃣  Búsqueda por los 5 primeros caracteres del GUID
   ----------------------------------------------------------------- */
router.get('/tickets/partial/:partial', authenticateInternal, async (req, res, next) => {
  try {
    const partial = req.params.partial.toLowerCase();
    const result = await executeQuery(
      `SELECT TOP 1 *
         FROM dbo.tickets
        WHERE CAST(id AS VARCHAR(36)) LIKE @partial + '%'
          AND deleted = 0`,
      { partial }
    );
    const ticket = result.recordset[0];
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

/* -----------------------------------------------------------------
   3️⃣  Tomar un ticket (sin JWT)
   ----------------------------------------------------------------- */
router.post('/tickets/:id/take', authenticateInternal, async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { user_id } = req.body;          // GUID del usuario de Telegram

    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }

    // Validamos que el usuario exista (opcional, pero más seguro)
    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ticket = await Ticket.takeTicket(ticketId, user_id);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

/* -----------------------------------------------------------------
   4️⃣  Tickets asignados a un usuario concreto
   ----------------------------------------------------------------- */
router.get(
  '/tickets/assigned/:userId',
  authenticateInternal,                 // solo el bot (header x‑internal‑secret)
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      // -------------------------------------------------
      // 1️⃣  Usamos un “usuario admin ficticio” para evitar
      //     que Ticket.findAll aplique filtros de hotel/central.
      // -------------------------------------------------
      const fakeAdmin = {
        role: UserRoles.ADMIN,
        id: userId,            // solo para que findAll no falle por falta de id
      };

      // -------------------------------------------------
      // 2️⃣  Buscamos todos los tickets cuyo assigned_to = userId
      // -------------------------------------------------
      const tickets = await Ticket.findAll(
        { assigned_to: userId },   // filtro
        fakeAdmin                  // user con privilegio total
      );

      // -------------------------------------------------
      // 3️⃣  Respondemos con el mismo formato que la UI usa
      // -------------------------------------------------
      res.json(tickets);
    } catch (err) {
      next(err);
    }
  }
);


/* -----------------------------------------------------------------
   Cambiar estado (endpoint interno usado por el bot)
   ----------------------------------------------------------------- */
router.patch('/tickets/:id/bot-status', authenticateInternal, async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { status, user_id, solution_type_id, solution } = req.body;

    if (!status) return res.status(400).json({ error: 'status required' });
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const allowed = Object.values(TicketStatus);
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }

    /* -------------------------------------------------
       VALIDACIÓN ESPECIAL PARA RESUELTO
       ------------------------------------------------- */
    if (status === TicketStatus.RESOLVED) {
      if (!solution_type_id) {
        return res.status(400).json({ error: 'solution_type_id required for RESOLVED' });
      }
      if (!solution || typeof solution !== 'string' || solution.trim().length === 0) {
        return res.status(400).json({ error: 'solution description required for RESOLVED' });
      }
    }

    // Verificamos que el usuario exista (opcional)
    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = await Ticket.updateTicket(ticketId, { status, solution_type_id, solution }, user);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

// src/routes/ticketTypes.routes.js
const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const TicketType = require('../models/TicketType');
const validate = require('../middleware/validate'); 
const { body } = require('express-validator');
const { TicketPriority, UserRoles } = require('../utils/constants');
const router = Router();

/* Listado – usuarios autenticados */
router.get('/ticket-types', authenticateToken, async (req, res, next) => {
  try {
    const data = await TicketType.findAll();
    res.json(data);
  } catch (e) {
    next(e);
  }
});

/* Crear – solo admin */
router.post('/ticket-types', authenticateToken, 
validate([
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('is_active').optional().isBoolean(),
  body('default_priority').optional().isIn(Object.values(TicketPriority)),
]),requireRoles([UserRoles.ADMIN]),
async (req, res, next) => {
  try {
    const tt = await TicketType.create(req.body);
    res.status(201).json(tt);
  } catch (e) {
    next(e);
  }
});

router.put('/ticket-types/:id', authenticateToken,
  validate([
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('is_active').optional().isBoolean(),
    body('default_priority').optional().isIn(Object.values(TicketPriority)),
  ])
  , requireRoles([UserRoles.ADMIN]),async (req, res, next) => {
  try {   
      const existent = await TicketType.findById(req.params.id);
      if (!existent) {
        return res.status(404).json({ error: 'Ticket type not found' });
      }

      // Actualizamos
      const updated = await TicketType.update(req.params.id, req.body);

      //   Sanitizamos la respuesta (eliminamos campos internos si existen)
      const safe = { ...updated };
      delete safe.created_at;
      delete safe.updated_at;
      // Si el modelo tiene más columnas sensibles, eliminarlas aquí.

      res.json(safe);
  } catch (e) {
    next(e);
  }});

/* Borrar – solo admin */
router.delete('/ticket-types/:id', authenticateToken, requireRoles([UserRoles.ADMIN]), async (req, res, next) => {
  try {
    await TicketType.delete(req.params.id);
    res.json({ message: 'Ticket type deleted' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

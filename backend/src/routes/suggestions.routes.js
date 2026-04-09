// src/routes/suggestions.routes.js
/**
 * Rutas para el recurso **Suggestion** (Propuestas).
 *
 * El front‑end utiliza los siguientes endpoints:
 *   GET    /suggestions                → listado (con filtro ?status=…)
 *   GET    /suggestions/:id            → detalle
 *   POST   /suggestions                → crear
 *   PUT    /suggestions/:id            → actualizar (status, asignado, etc.)
 *   POST   /suggestions/:id/take       → “tomar” la Propuesta (asigna al usuario)
 *   DELETE /suggestions/:id            → eliminar
 *
 * Todos los endpoints requieren que el usuario esté autenticado.
 * Algunas operaciones (actualizar, tomar, borrar) están restringidas a
 * administradores y técnicos, tal y como lo hace la UI.
 */

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const Suggestion = require('../models/Suggestion');
const { UserRoles,SuggestionStatus } = require('../utils/constants');
const validate = require('../middleware/validate');
const { body } = require('express-validator');
const router = Router();
/* -------------------------------------------------
   GET /suggestions/project/:projectId   ← IMPORTANTE : antes de :id
   ------------------------------------------------- */
router.get(
  '/suggestions/project/:projectId',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { projectId } = req.params;
      
      // ✅ Validar que el usuario tenga acceso al proyecto
      const Project = require('../models/Project');
      const project = await Project.findById(projectId, req.user);
      
      if (!project) {
        return res.status(404).json({ error: 'Project not found or access denied' });
      }

      // Si el usuario puede ver el proyecto, entonces puede ver sus sugerencias
      const suggestions = await Suggestion.findByProjectId(projectId);
      res.json(suggestions);
    } catch (err) {
      next(err);
    }
  }
);

/* -----------------------------------------------------------------
 * GET /suggestions
 * --------------------------------------------------------------- */
router.get(
  '/suggestions',
  authenticateToken,
  validate([
    body('title').optional().trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('benefits').optional().trim().isLength({ max: 500 }),
    body('project_id').optional().isUUID(),
    body('status').optional().isIn(Object.values(SuggestionStatus)),
    body('assigned_to').optional().isUUID(),
  ]),
  async (req, res, next) => {
    try {
      // Sólo filtramos por status (el front‑end lo usa)
      const filters = {
        status: req.query.status,
      };
      const suggestions = await Suggestion.findAll(filters);
      res.json(suggestions);
    } catch (err) {
      next(err);
    }
  }
);

/* -----------------------------------------------------------------
 * GET /suggestions/:id
 * --------------------------------------------------------------- */
router.get(
  '/suggestions/:id',
  authenticateToken,
  async (req, res, next) => {
    try {
      const suggestion = await Suggestion.findById(req.params.id);
      if (!suggestion) {
        return res.status(404).json({ error: 'Suggestion not found' });
      }
      res.json(suggestion);
    } catch (err) {
      next(err);
    }
  }
);

/* -----------------------------------------------------------------
 * POST /suggestions   – crear una nueva Propuesta
 * --------------------------------------------------------------- */
router.post(
  '/suggestions',
  authenticateToken,
  async (req, res, next) => {
    try {
      // El creador es el usuario autenticado (sub = id del usuario)
      const newSuggestion = await Suggestion.create(req.body, req.user.sub);
      res.status(201).json(newSuggestion);
    } catch (err) {
      next(err);
    }
  }
);

/* -----------------------------------------------------------------
 * PUT /suggestions/:id   – actualizar (status, asignado, etc.)
 * Sólo administradores y técnicos pueden modificar una Propuesta.
 * --------------------------------------------------------------- */
router.put(
  '/suggestions/:id',
  authenticateToken,
   validate([
    body('title').optional().trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('benefits').optional().trim().isLength({ max: 500 }),
    body('project_id').optional().isUUID(),
    body('assigned_to').optional().isUUID(),
    body('status').optional().isIn(Object.values(SuggestionStatus)),
    body('cancellation_reason').optional().trim().isLength({ max: 500 }),
  ])
  ,requireRoles(['admin', 'technician']),
  async (req, res, next) => {
    try {
      const updated = await Suggestion.update(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Suggestion not found' });
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/* -----------------------------------------------------------------
 * POST /suggestions/:id/take   – asignar la Propuesta al usuario actual
 * Sólo administradores y técnicos pueden "tomar" una Propuesta.
 * --------------------------------------------------------------- */
router.post(
  '/suggestions/:id/take',
  authenticateToken,
  requireRoles(['admin', 'technician']),
  async (req, res, next) => {
    try {
      const suggestion = await Suggestion.findById(req.params.id);
      if (!suggestion) {
        return res.status(404).json({ error: 'Suggestion not found' });
      }

      // Se asigna al usuario que ejecuta la llamada y se pasa al estado
      // “in_study” (en estudio). Puedes ajustar el estado según tu lógica.
      const updated = await Suggestion.update(req.params.id, {
        assigned_to: req.user.sub,
        status: 'in_study',
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);


/* -----------------------------------------------------------------
 * DELETE /suggestions/:id   – eliminar una Propuesta
 * Sólo administradores pueden borrar.
 * --------------------------------------------------------------- */
router.delete(
  '/suggestions/:id',
  authenticateToken,
  requireRoles(['admin']),
  async (req, res, next) => {
    try {
      await Suggestion.delete(req.params.id);
      res.json({ message: 'Suggestion deleted' });
    } catch (err) {
      next(err);
    }
  }
);

/* -----------------------------------------------------------------
 * Exportamos el router para que sea montado en src/app.js
 * --------------------------------------------------------------- */
module.exports = router;

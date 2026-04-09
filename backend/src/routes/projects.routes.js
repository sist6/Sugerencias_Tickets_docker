// src/routes/projects.routes.js
/**
 * Rutas del recurso **Project** (proyectos).
 *
 * Endpoints que expone el frontend:
 *
 *   GET    /projects                     → listado (con filtros opcionales)
 *   GET    /projects/:id                 → detalle de un proyecto
 *   POST   /projects                     → crear proyecto
 *   PUT    /projects/:id                 → actualizar (cambio de estado, datos, etc.)
 *   DELETE /projects/:id                 → eliminar proyecto
 *
 * Todas las rutas están protegidas con `authenticateToken`.
 * Sólo los usuarios con rol **admin** o **technician** pueden crear,
 * actualizar o eliminar.  El listado y detalle pueden ver cualquier
 * usuario autenticado (el propio front‑end filtra según permisos).
 */

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const Project = require('../models/Project');
const validate = require('../middleware/validate');
const {ProjectStatus, UserRoles} = require('../utils/constants');
const { body } = require('express-validator');
const router = Router();

/* -------------------------------------------------------------
 * GET /projects
 * ----------------------------------------------------------- */
router.get(
  '/projects',
  authenticateToken,
  async (req, res, next) => {
    try {
      // Filtros opcionales vía query‑string (p.e. status, created_by)
      const filters = {
        status: req.query.status,
        created_by: req.query.created_by,
      };

      const projects = await Project.findAll(req.user,filters);
      res.json(projects);
    } catch (err) {
      next(err);
    }
  }
);

/* -------------------------------------------------------------
 * GET /projects/:id
 * ----------------------------------------------------------- */
router.get(
  '/projects/:id',
  authenticateToken,
  async (req, res, next) => {
    try {
      const project = await Project.findById(req.params.id, req.user);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json(project);
    } catch (err) {
      next(err);
    }
  }
);




/* -------------------------------------------------------------
 * POST /projects   – crear un proyecto
 * ----------------------------------------------------------- */
router.post(
  '/projects',
  authenticateToken,
  validate([
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('status').optional().isIn(Object.values(ProjectStatus)),
    body('user_ids').optional().isArray(),
    body('user_ids.*').isUUID(),
    body('department_id').optional().isUUID(),
    body('department_ids.*').optional().isUUID(),
    body('hotel_id').optional().isUUID(),
  ])
  ,
  requireRoles(['admin', 'technician']), // CORRECTO: admin y tech pueden crear
  async (req, res, next) => {
    try {
      // El creador del proyecto es el usuario autenticado
      const created = await Project.create(req.body, req.user.sub);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
);

/* -------------------------------------------------------------
 * PUT /projects/:id   – actualizar proyecto (status, datos, etc.)
 * ----------------------------------------------------------- */
router.put(
  '/projects/:id',
  authenticateToken,
   validate([
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('status').optional().isIn(Object.values(ProjectStatus)),
    body('user_ids').optional().isArray(),
    body('user_ids.*').isUUID(),
    body('department_id').optional().isUUID(),
    body('department_ids.*').optional().isUUID(),
    body('hotel_id').optional().isUUID(),
  ]),
  requireRoles(['admin', 'technician']),
  async (req, res, next) => {
    try {
      // pasamos también `req.user` (necesario para que update pueda llamar a findById)
      const updated = await Project.update(req.params.id, req.body, req.user);
      if (!updated) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);
/* -------------------------------------------------------------
 * DELETE /projects/:id   – eliminar proyecto
 * ----------------------------------------------------------- */
router.delete(
  '/projects/:id',
  authenticateToken,
  requireRoles(['admin', 'technician']),
  async (req, res, next) => {
    try {
      await Project.delete(req.params.id);
      res.json({ message: 'Project deleted' });
    } catch (err) {
      next(err);
    }
  }
);

/* -------------------------------------------------------------
 * Exportamos el router para que `src/app.js` lo monte.
 * ----------------------------------------------------------- */
module.exports = router;

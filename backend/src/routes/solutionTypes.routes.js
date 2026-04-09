// src/routes/solutionTypes.routes.js
const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const SolutionType = require('../models/SolutionType');
const validate = require('../middleware/validate');
const { body } = require('express-validator');
const {userRoles} = require('../utils/constants');
const router = Router();

/* ─ GET ─ */
router.get('/solution-types', authenticateToken, async (req, res, next) => {
  try {
    const types = await SolutionType.getAll();
    res.json(types);
  } catch (err) {
    next(err);
  }
});

/* ─ POST ─ */
router.post('/solution-types', authenticateToken,
  validate([
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('incident_type_ids').optional().isArray(),
    body('incident_type_ids.*').isUUID(),
  ]),
  async (req, res, next) => {
  try {
    const { name, description, incident_type_ids } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const newType = await SolutionType.create({
      name,
      description,
      incident_type_ids,               // ← llega como array (ej.: ["id1","id2"])
    });
    res.status(201).json(newType);
  } catch (err) {
    next(err);
  }
});

/* ─ PUT ─ (actualización) */
router.put('/solution-types/:id', authenticateToken,
   validate([
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('incident_type_ids').optional().isArray(),
    body('incident_type_ids.*').isUUID(),
  ]),
  async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, incident_type_ids } = req.body;
    await SolutionType.update(id, { name, description, incident_type_ids });
    res.status(204).send();          // sin cuerpo, sólo código 204
  } catch (err) {
    next(err);
  }
});

/* ─ DELETE (soft‑delete) ─ */
router.delete('/solution-types/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    await SolutionType.delete(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

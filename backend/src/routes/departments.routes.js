// src/routes/departments.routes.js
const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const Department = require('../models/Department');
const validate = require('../middleware/validate');
const { body } = require('express-validator'); 
const router = Router();

/* Listado – solo usuarios autenticados */
router.get('/departments', authenticateToken, async (req, res, next) => {
  try {
    const data = await Department.findAll();
    res.json(data);
  } catch (e) {
    next(e);
  }
});

/* Crear – solo admin */
router.post('/departments', authenticateToken, requireRoles(['admin']), 
validate([
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('is_active').optional().isBoolean(),
])
,async (req, res, next) => {
  try {
    const dep = await Department.create(req.body);
    res.status(201).json(dep);
  } catch (e) {
    next(e);
  }
});

/* Actualizar – solo admin */
router.put('/departments/:id', authenticateToken, requireRoles(['admin']),
  validate([
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('is_active').optional().isBoolean(),
  ])
  ,async (req, res, next) => {
  try {
    const updated = await Department.update(req.params.id, req.body);
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

/* Borrar – solo admin */
router.delete('/departments/:id', authenticateToken, requireRoles(['admin']), async (req, res, next) => {
  try {
    await Department.delete(req.params.id);
    res.json({ message: 'Department deleted' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

// src/routes/roles.routes.js
const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const Role = require('../models/Role');

const router = Router();

/* Listado – solo usuarios con permiso de gestión de usuarios (admin / tech) */
router.get('/roles', authenticateToken, requireRoles(['admin', 'technician']), async (req, res, next) => {
  try {
    const data = await Role.findAll();
    res.json(data);
  } catch (e) {
    next(e);
  }
});

/* Crear – solo admin / technician */
router.post('/roles', authenticateToken, requireRoles(['admin', 'technician']), async (req, res, next) => {
  try {
    const role = await Role.create(req.body);
    res.status(201).json(role);
  } catch (e) {
    next(e);
  }
});

/* Borrar – solo admin / technician */
router.delete('/roles/:id', authenticateToken, requireRoles(['admin', 'technician']), async (req, res, next) => {
  try {
    await Role.delete(req.params.id);
    res.json({ message: 'Role deleted' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

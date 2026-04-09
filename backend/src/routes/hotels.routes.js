// src/routes/hotels.routes.js
const { Router } = require('express');
const { executeQuery } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const validate = require('../middleware/validate');
const { body } = require('express-validator');

const router = Router();

/* ---------- Listado (cualquier usuario) ---------- */
router.get(
  '/hotels',
  authenticateToken,
  async (req, res, next) => {
    try {
      const result = await executeQuery(
        `SELECT id, name, code, address, is_active, created_at, updated_at FROM hotels`,
        {}
      );
      res.json(result.recordset);
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- Crear (solo admin) ---------- */
router.post(
  '/hotels',
  authenticateToken,
  requireRoles(['admin']),
  validate([
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('code').trim().isLength({ min: 1, max: 20 }),
    body('address').trim().isLength({ min: 1, max: 200 }),
    body('is_active').optional().isBoolean(),
  ]),
  async (req, res, next) => {
    try {
      const { name, code, address, is_active = true } = req.body;
      const result = await executeQuery(
        `INSERT INTO hotels (id, name, code, address, is_active, created_at, updated_at)
         VALUES (NEWID(), @name, @code, @address, @is_active, GETUTCDATE(), GETUTCDATE())`,
        { name, code, address, is_active: is_active ? 1 : 0 }
      );
      // No retornamos el id (SQL Server lo genera), pero el cliente suele refrescar
      res.status(201).json({ message: 'Hotel created' });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- Actualizar (solo admin) ---------- */
router.put(
  '/hotels/:id',
  authenticateToken,
  requireRoles(['admin']),
  validate([
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('code').optional().trim().isLength({ min: 1, max: 20 }),
    body('address').optional().trim().isLength({ min: 1, max: 200 }),
    body('is_active').optional().isBoolean()
    ]),
  async (req, res, next) => {
    try {
      const { name, code, address, is_active } = req.body;
      const setParts = [];
      const params = { id: req.params.id };
      if (name !== undefined) { setParts.push('name = @name'); params.name = name; }
      if (code !== undefined) { setParts.push('code = @code'); params.code = code; }
      if (address !== undefined) { setParts.push('address = @address'); params.address = address; }
      if (is_active !== undefined) { setParts.push('is_active = @is_active'); params.is_active = is_active ? 1 : 0; }

      if (setParts.length === 0) return res.status(400).json({ error: 'No fields to update' });

      setParts.push('updated_at = GETUTCDATE()');
      const setClause = setParts.join(', ');
      await executeQuery(`UPDATE hotels SET ${setClause} WHERE id = @id`, params);
      res.json({ message: 'Hotel updated' });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- Borrar (solo admin) ---------- */
router.delete(
  '/hotels/:id',
  authenticateToken,
  requireRoles(['admin']),
  async (req, res, next) => {
    try {
      await executeQuery(`DELETE FROM hotels WHERE id = @id`, { id: req.params.id });
      res.json({ message: 'Hotel deleted' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

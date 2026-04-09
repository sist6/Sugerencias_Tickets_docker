// backend/src/routes/seed.js
const router = require('express').Router();

/**
 * GET /api/seed
 * Devuelve algún dato de “seed” (ejemplo)
 */
router.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'Endpoint /api/seed activo',
    timestamp: new Date(),
  });
});

module.exports = router;

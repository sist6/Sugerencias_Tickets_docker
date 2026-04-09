/**
 * Middleware de validación usando `express-validator`.
 *
 * Uso típico:
 *
 *   const { body } = require('express-validator');
*   const validate = require('../middleware/validate');
 *
 *   router.post(
 *     '/tickets',
 *     authenticateToken,
 *     validate([
 *       body('title').isString().isLength({ min: 1, max: 255 }).trim(),
 *       body('description').isString().trim(),
 *       body('ticket_type_id').isUUID(),
 *     ]),
 *     ticketsController.create
 *   );
 *
 * Si las validaciones fallan, responde 400 con un array de errores.
 */
const { validationResult } = require('express-validator');

module.exports = (validations) => async (req, res, next) => {
  // Ejecutamos todas las validaciones en paralelo
  await Promise.all(validations.map((validation) => validation.run(req)));

  const errors = validationResult(req);
  if (errors.isEmpty()) {
   return next();
  }

  return res.status(400).json({ errors: errors.array() });
};
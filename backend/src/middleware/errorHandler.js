// src/middleware/errorHandler.js
/**
 * Middleware de manejo de errores.
 * Debe estar al final de la cadena de middlewares.
 */

function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  console.error(`[${new Date().toISOString()}]`, err);
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
}

module.exports = {
  errorHandler,
};

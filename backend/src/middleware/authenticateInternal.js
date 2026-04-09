// src/middleware/internal.js
module.exports.authenticateInternal = (req, res, next) => {
  const secret = req.headers['x-internal-secret'];
  if (secret && secret === process.env.INTERNAL_API_SECRET) {
    return next();
  }
  return res.status(401).json({ error: 'Invalid internal secret' });
};

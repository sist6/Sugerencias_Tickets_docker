const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET, JWT_EXPIRES_IN_HOURS } = require('../config/env');

/**
 * Middleware que comprueba el JWT.
 * Busca el token:
 *   1️⃣ En el header Authorization:  "Bearer <token>"
 *   2️⃣ Si no está, en la cookie HttpOnly llamada "token"
 */
function authenticateToken(req, res, next) {
  // ---- 1️⃣ Header ----
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  // ---- 2️⃣ Cookie (fallback) ----
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ detail: 'Token no proporcionado' });
  }

  // ---- Verificación del JWT ----
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ detail: 'Token expirado' });
      }
      return res.status(401).json({ detail: 'Token inválido' });
    }
    // El payload del token lo guardamos en req.user
    req.user = decoded;
    next();
  });
}

/**
 * Genera un JWT a partir del payload que recibimos.
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${JWT_EXPIRES_IN_HOURS}h`,
  });
}

/**
 * Verifica un token sin usar middleware (útil para WS y otras utilidades).
 */
function verifyToken(token) {
  // `jwt.verify` lanza excepción si el token es inválido/expirado.
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Entrada: { email, name, microsoft_id }
 * - Busca al usuario por `microsoft_id`.
 * - Si no existe, crea uno (contraseña aleatoria).
 * - Genera JWT.
 * - Devuelve: { access_token, user, is_new }
 */
async function microsoftAuth(req, res, next) {
  try {
    const { email, name, microsoft_id } = req.body;

    if (!email || !microsoft_id) {
      return res.status(400).json({ error: 'Faltan datos de Microsoft' });
    }

    // --- Búsqueda/creación del usuario (igual que antes) ---
    let user = await User.findByEmail(email);
    if (user && !user.microsoft_id) {
      await User.updateUser(user.id, { microsoft_id });
      user = await User.findById(user.id);
    }
    if (!user) {
      const randomPass = Math.random().toString(36).slice(-10);
      user = await User.createUser({
        email,
        password: randomPass,
        name,
        role: 'hotel_user',
        microsoft_id,
        hotel_ids: [],
        project_ids: [],
      });
    }

    // --- Payload del JWT ---
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    // --- Generamos el token ---
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: `${JWT_EXPIRES_IN_HOURS}h`,
    });

    // --- **Seteamos la cookie HttpOnly** ---
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true sólo en prod
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'none', // <-- cambiar a none en dev
      maxAge: JWT_EXPIRES_IN_HOURS * 3600 * 1000,
    });

    // Opcional: devolvemos el usuario (sin token) – el cliente ya tiene la cookie
    const safeUser = { ...user };
    delete safeUser.password_hash;
    delete safeUser.microsoft_id;

    return res.json({
      // Si quieres que el cliente use el token inmediatamente (ej. WS que no envía cookie)
      // access_token: token,
      user: safeUser,
      is_new: false,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  authenticateToken,
  generateToken,
  verifyToken,
  microsoftAuth,
};

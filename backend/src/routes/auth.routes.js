// src/routes/auth.routes.js
const { Router } = require('express');
const {
  authenticateToken,
  generateToken,
  microsoftAuth,
} = require('../middleware/auth');
const { JWT_EXPIRES_IN_HOURS } = require('../config/env');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const router = Router();

/* -----------------------------------------------------------------
   Helpers para la cookie
   ----------------------------------------------------------------- */
function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax', // en dev puede ser lax
    secure: isProd, // true sólo con HTTPS
    maxAge: Number(JWT_EXPIRES_IN_HOURS) * 3600 * 1000,
  };
}

/* ---------- Registro ---------- */
router.post('/auth/register', async (req, res, next) => {
  try {
    const {
      email,
      password,
      name,
      role,
      department_id,
      hotel_ids,
      can_create_suggestions,
      can_access_tickets,
      is_active,
    } = req.body;

    const exists = await User.findByEmail(email);
    if (exists) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const newUser = await User.createUser({
      email,
      password,
      name,
      role,
      department_id,
      hotel_ids,
      can_create_suggestions,
      can_access_tickets,
      is_active,
    });

    const token = generateToken({
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    // Guardamos la cookie de sesión
    res
      .cookie('token', token, cookieOptions())
      .status(201)
      .json({ user: newUser });
  } catch (err) {
    next(err);
  }
});

/* ---------- Login ---------- */
router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ detail: 'Credenciales inválidas' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ detail: 'Credenciales inválidas' });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    const token = generateToken(payload);

    // Cookie de sesión
    res
      .cookie('token', token, cookieOptions())
      .json({ user: { ...user, password_hash: undefined, microsoft_id: undefined } });
  } catch (err) {
    next(err);
  }
});

/* ---------- Microsoft ---------- */
router.post('/auth/microsoft', microsoftAuth);

/* ---------- Me ---------- */
router.get(
  '/auth/me',
  authenticateToken,
  // requireRoles(['admin', 'technician']), // opcional
  async (req, res, next) => {
    try {
      const user = await User.findById(req.user.sub);
      if (!user) {
        return res.status(404).json({ detail: 'Usuario no encontrado' });
      }
      // Eliminamos datos sensibles antes de enviarlos
      const safe = { ...user };
      delete safe.password_hash;
      delete safe.microsoft_id;
      res.json({ user: safe });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- Logout ---------- */
router.post('/auth/logout', authenticateToken, (req, res) => {
  res.clearCookie('token').json({ message: 'Logged out successfully' });
});

module.exports = router;

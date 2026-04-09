// src/routes/seed.routes.js
/**
 * Endpoint de desarrollo que crea el usuario administrador si aún no existe.
 * No requiere autenticación.
 */

const { Router } = require('express');
const User = require('../models/User');

const router = Router();

router.post('/seed', async (req, res, next) => {
  try {
    const adminEmail = 'admin@sohohoteles.com';
    const adminPassword = 'admin123';

    // Si ya existe, simplemente lo devolvemos
    const existing = await User.findByEmail(adminEmail);
    if (existing) {
      return res.json({
        message: 'Data already seeded',
        admin_email: adminEmail,
        admin_password: adminPassword,
      });
    }

    // Creamos el admin
    const admin = await User.createUser({
      email: adminEmail,
      password: adminPassword,
      name: 'Administrador Sistema',
      role: 'admin',
      can_create_suggestions: true,
      can_access_tickets: true,
      is_active: true,
    });

    // (Opcional) crear un técnico y un usuario central para pruebas
    await User.createUser({
      email: 'tecnico@sohohoteles.com',
      password: 'tecnico123',
      name: 'Técnico Sistema',
      role: 'technician',
      can_create_suggestions: true,
    });

    await User.createUser({
      email: 'central@sohohoteles.com',
      password: 'central123',
      name: 'Usuario Central',
      role: 'central_user',
      can_create_suggestions: false,
      can_access_tickets: true,
    });

    res.json({
      message: 'Data seeded',
      admin_email: adminEmail,
      admin_password: adminPassword,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

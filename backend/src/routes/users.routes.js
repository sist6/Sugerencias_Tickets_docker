// src/routes/users.routes.js
const { Router } = require('express');
const User = require('../models/User');
const {UserRoles} = require('../utils/constants');
const { authenticateToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticateInternal } = require('../middleware/authenticateInternal');
const {
  getTelegramLink,
  getTelegramStatus,
  patchTelegramStatus,
  botSaveChatId,

} = require('../controllers/userTelegram.controller');
const { linkChatInBackend } = require('../bot/telegramBot');
const router = Router();

/* ---------- Listado ---------- */
router.get(
  '/users',
  authenticateToken,
  async (req, res, next) => {
    try {
      const users = await User.findAll();
      res.json(users);
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- Detalle (cualquiera autenticado) ---------- */
router.get(
  '/users/:id',
  authenticateToken,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const safe = { ...user };
      delete safe.password_hash;
      res.json(safe);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/users',
  authenticateToken,
  validate([
    body('email').isEmail().normalizeEmail(),
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('password').optional().isLength({ min: 6 }),
    body('role').isIn(Object.values(UserRoles)),
    body('department_id').optional().isUUID().withMessage('Debe ser un UUID válido'),
    body('hotel_ids').optional().isArray(),
    body('hotel_ids.*').isUUID(),
    body('can_create_suggestions').optional().isBoolean(),
    body('can_access_tickets').optional().isBoolean(),
    body('is_active').optional().isBoolean(),
    body('project_ids').optional().isArray(),
    body('project_ids.*').isUUID(),
  ]),
  requireRoles([UserRoles.ADMIN, UserRoles.TECHNICIAN]),
  async (req, res, next) => {
    try {
      const { role } = req.body;

      // Si se solicita crear un admin y el solicitante NO es admin → prohibido
      if (role && role === UserRoles.ADMIN && req.user.role !== UserRoles.ADMIN) {
        return res
          .status(403)
          .json({ error: 'Solo un administrador puede crear usuarios con rol admin' });
      }

      const newUser = await User.createUser(req.body);
      const safe = { ...newUser };
      delete safe.password_hash;
      res.status(201).json(safe);
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- Actualizar (admin & technician) ----------
   - Admin puede modificar cualquier campo, incluido el rol.
   - Technician solo puede cambiar el rol de usuarios que NO sean admin ni technician,
     y el nuevo rol NO puede ser admin ni technician.
*/
router.put(
  '/users/:id',
  authenticateToken,
  
  validate([
    body('email').isEmail().normalizeEmail(),
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('password').optional().isLength({ min: 6 }),
    body('role').isIn(Object.values(UserRoles)),
    body('department_id').optional().isUUID().withMessage('Debe ser un UUID válido'),
    body('hotel_ids').optional().isArray(),
    body('hotel_ids.*').isUUID(),
    body('can_create_suggestions').optional().isBoolean(),
    body('can_access_tickets').optional().isBoolean(),
    body('is_active').optional().isBoolean(),
    body('project_ids').optional().isArray(),
    body('project_ids.*').isUUID(),
  ]),
  requireRoles([UserRoles.ADMIN, UserRoles.TECHNICIAN]),
  async (req, res, next) => {
    try {
      // 1️⃣  Verificamos que el usuario objetivo exista
      const targetUser = await User.findById(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const requesterRole = req.user.role; // rol del que hace la petición
      const { role: newRole } = req.body; // rol que se quiere asignar (puede ser undefined)

      // 2️⃣  Lógica de autorización de cambios de rol
      if (newRole) {
        if (requesterRole === UserRoles.TECHNICIAN) {
          // a) El técnico no puede tocar usuarios admin o tech
          if ([UserRoles.ADMIN, UserRoles.TECHNICIAN].includes(targetUser.role)) {
            return res
              .status(403)
              .json({
                error:
                  'Los técnicos no pueden modificar usuarios con rol admin o técnico',
              });
          }

          // b) El técnico no puede asignar los roles admin ni technician
          if ([UserRoles.ADMIN, UserRoles.TECHNICIAN].includes(newRole)) {
            return res
              .status(403)
              .json({
                error:
                  'Los técnicos no pueden asignar los roles admin o técnico',
              });
          }
        }
        // Si el solicitante es admin, no hay restricción adicional.
      }

      // 3️⃣  Se procede con la actualización
      const updated = await User.updateUser(req.params.id, req.body);
      const safe = { ...updated };
      delete safe.password_hash;
      res.json(safe);
    } catch (err) {
      next(err);
    }
  }
);

/* -----------------------------------------------------------------
   **RUTAS DE TELEGRAM** (IMPORTANTE: incluyan el prefijo `/users`)
   ----------------------------------------------------------------- */

/* Enlace deep‑link → devuelve la URL del bot */
router.get('/users/:id/telegram-link',
  authenticateToken,
  getTelegramLink
);

/* Estado del vínculo (linked / enabled) */
router.get('/users/:id/telegram',
  authenticateToken,
  getTelegramStatus
);

/* Activar / desactivar notificaciones Telegram */
router.patch('/users/:id/telegram',
  authenticateToken,
  patchTelegramStatus
);

/* Endpoint interno llamado por el bot (guarda chat_id) */
router.post('/users/:id/telegram',
  authenticateInternal,
  botSaveChatId,
);



/* ---------- Borrar (solo admin) ---------- */
router.delete(
  '/users/:id',
  authenticateToken,
  requireRoles([UserRoles.ADMIN]),
  async (req, res, next) => {
    try {
      await User.deleteUser(req.params.id);
      res.json({ message: 'User deleted' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

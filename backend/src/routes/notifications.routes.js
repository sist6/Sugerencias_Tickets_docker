// src/routes/notifications.routes.js
const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const Notification = require('../models/Notification');

const router = Router();

/* GET /notifications → listado del usuario logueado */
router.get('/notifications', authenticateToken, async (req, res, next) => {
  try {
    const data = await Notification.findAllForUser(req.user.sub);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

/* GET /notifications/unread-count → número de no leídas */
router.get('/notifications/unread-count', authenticateToken, async (req, res, next) => {
  try {
    const count = await Notification.countUnread(req.user.sub);
    res.json({ count });
  } catch (e) {
    next(e);
  }
});

/* PUT /notifications/:id/read → marcar una sola como leída */
router.put('/notifications/:id/read', authenticateToken, async (req, res, next) => {
  try {
    const notif = await Notification.markAsRead(req.params.id);
    res.json(notif);
  } catch (e) {
    next(e);
  }
});

/* PUT /notifications/read-all → marcar todas como leídas */
router.put('/notifications/read-all', authenticateToken, async (req, res, next) => {
  try {
    const all = await Notification.markAllReadForUser(req.user.sub);
    res.json(all);
  } catch (e) {
    next(e);
  }
});

module.exports = router;

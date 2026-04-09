/**
 * Dashboard Stats Routes
 * Unified endpoint for dashboard metrics across tickets/projects/suggestions
 */

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const Ticket = require('../models/Ticket');
const Project = require('../models/Project');
const Suggestion = require('../models/Suggestion');

const router = Router();

/**
 * GET /api/dashboard/stats
 * Returns unified stats for dashboard:
 * {
 *   tickets: {total, open, resolved, closed, critical, high},
 *   projects: {active, study, visible},
 *   suggestions: {total, taken, approved, cancelled, mine}
 * }
 */
router.get(
  '/dashboard/stats',
  authenticateToken,
  async (req, res, next) => {
    try {
      const user = {
        ...req.user,
        id: req.user.id ?? req.user.sub,
      };

      // Fetch stats in parallel from all models
      const [ticketStats, projectStats, suggestionStats] = await Promise.all([
        Ticket.getStats(user),
        Project.getStats ? Project.getStats(user) : { projects: { active: 0, study: 0, visible: 0 } },
        Suggestion.getStats ? Suggestion.getStats(user) : { suggestions: { total: 0, taken: 0, mine: 0 } }
      ]);

      // Merge into unified response matching frontend expectations
      const stats = {
        tickets: ticketStats.tickets || { total: 0, open: 0, resolved: 0, closed: 0, critical: 0, high: 0 },
        projects: projectStats.projects || { active: 0, study: 0, visible: 0 },
        suggestions: suggestionStats.suggestions || { total: 0, taken: 0, approved: 0, cancelled: 0, mine: 0 }
      };

      res.json(stats);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;


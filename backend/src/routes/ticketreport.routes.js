// src/routes/ticketsreport.routes.js
/*********************************************************************
 *  ticketsreport.routes.js
 *
 *  Endpoint: GET /ticketsreport/stats
 *
 *  Devuelve:
 *    • estadísticos generales (Ticket.getStats)
 *    • tickets resueltos este mes y esta semana
 *    • métricas por tipo de incidencia y por tipo de solución
 *    • tendencia de tickets RESUELTOS (mes‑a‑mes)
 *
 *********************************************************************/

const { Router } = require("express");
const { authenticateToken } = require("../middleware/auth");
const Ticket = require("../models/Ticket");
const db = require("../config/db");

const router = Router();

/* -----------------------------------------------------------------
   ENDPOINT – /ticketsreport/stats
   ----------------------------------------------------------------- */
router.get(
  "/ticketsreport/stats",
  authenticateToken,
  async (req, res, next) => {
    try {
      const user = req.user;

      // -------------------------------------------------
      //  Parse date range from query params (ISO strings)
      // -------------------------------------------------
      // Normalizamos a:
      //   - date_from → 00:00:00.000 (inicio del día)
      //   - date_to   → 23:59:59.999 (fin del día)
      // Usamos los métodos UTC para evitar problemas de zona horaria.
      let dateFrom = null;
      let dateTo = null;

      if (req.query.date_from) {
        const parsed = new Date(req.query.date_from);
        if (isNaN(parsed.getTime())) {
          return res
            .status(400)
            .json({ error: "Invalid date_from format (use ISO)" });
        }
        parsed.setUTCHours(0, 0, 0, 0);
        dateFrom = parsed;
      }

      if (req.query.date_to) {
        const parsed = new Date(req.query.date_to);
        if (isNaN(parsed.getTime())) {
          return res
            .status(400)
            .json({ error: "Invalid date_to format (use ISO)" });
        }
        parsed.setUTCHours(23, 59, 59, 999);
        dateTo = parsed;
      }

      /* -------------------------------------------------
         1️⃣  Estadísticas generales del usuario
         ------------------------------------------------- */
      const ticketsStats = await Ticket.getStats(user);

      /* -------------------------------------------------
         2️⃣  Tickets RESUELTOS – ESTE MES y ESTA SEMANA
         -------------------------------------------------
         Estos indicadores siempre reflejan el mes y la semana
         actuales, sin depender de los filtros enviados por el
         cliente.
      */
      const now = new Date();

      // ---------- MES ACTUAL ----------
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0,
        0
      );
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
        0,
        0,
        0,
        0
      );

      const monthQuery = `
        SELECT COUNT(*) AS resolved
        FROM dbo.tickets
        WHERE status = 'resolved'
          AND resolved_at >= @monthStart
          AND resolved_at < @monthEnd
      `;
      const { recordset: monthRes } = await db.executeQuery(monthQuery, {
        monthStart,
        monthEnd,
      });

      // ---------- SEMANA ACTUAL (lunes‑domingo) ----------
      const weekStart = new Date(now);
      // Monday is the first day of the week (0 = Sunday)
      weekStart.setDate(now.getDate() - now.getDay() + 1);
      weekStart.setUTCHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const weekQuery = `
        SELECT COUNT(*) AS resolved
        FROM dbo.tickets
        WHERE status = 'resolved'
          AND resolved_at >= @weekStart
          AND resolved_at < @weekEnd
      `;
      const { recordset: weekRes } = await db.executeQuery(weekQuery, {
        weekStart,
        weekEnd,
      });

      /* -------------------------------------------------
         3️⃣  Métricas por Tipo de Incidencia (filtradas por RESUELTO)
         ------------------------------------------------- */
      let incidenceWhere = "1=1";
      const incidenceParams = {};
      if (dateFrom || dateTo) {
        incidenceWhere +=
          " AND t.resolved_at >= @dateFrom AND t.resolved_at <= @dateTo";
        incidenceParams.dateFrom = dateFrom;
        incidenceParams.dateTo = dateTo;
      }

      const byIncidence = await db.executeQuery(
        `
        SELECT tt.name, COUNT(*) AS value
        FROM dbo.tickets t
        JOIN dbo.ticket_types tt ON t.ticket_type_id = tt.id
        WHERE ${incidenceWhere}
        GROUP BY tt.name
        ORDER BY value DESC
      `,
        incidenceParams
      );

      /* -------------------------------------------------
         4️⃣  Métricas por Tipo de Solución (filtradas por RESUELTO)
         ------------------------------------------------- */
      let solutionWhere = "1=1";
      const solutionParams = {};
      if (dateFrom || dateTo) {
        solutionWhere +=
          " AND t.resolved_at >= @dateFrom AND t.resolved_at <= @dateTo";
        solutionParams.dateFrom = dateFrom;
        solutionParams.dateTo = dateTo;
      }

      const bySolution = await db.executeQuery(
        `
        SELECT st.name,
               COUNT(t.id) AS value
        FROM dbo.solution_types st
        LEFT JOIN dbo.tickets t
          ON t.solution_type_id = st.id
        WHERE ${solutionWhere}
        GROUP BY st.name
        ORDER BY value DESC
      `,
        solutionParams
      );

      /* -------------------------------------------------
         5️⃣  Tendencia (tickets RESUELTOS por mes)
         ------------------------------------------------- */
      let trendWhere = "1=1";
      const trendParams = {};
      if (dateFrom || dateTo) {
        trendWhere +=
          " AND t.resolved_at >= @date_from AND t.resolved_at <= @date_to";
        trendParams.date_from = dateFrom;
        trendParams.date_to = dateTo;
      }

      const trendData = await db.executeQuery(
        `
        SELECT FORMAT(t.resolved_at, 'yyyy-MM') AS month,
               COUNT(*) AS tickets
        FROM dbo.tickets t
        WHERE ${trendWhere}
        GROUP BY FORMAT(t.resolved_at, 'yyyy-MM')
        ORDER BY month
      `,
        trendParams
      );

      /* -------------------------------------------------
         6️⃣  Responder al cliente
         ------------------------------------------------- */
      res.json({
        tickets: ticketsStats,
        by_incident_type: byIncidence.recordset,
        by_solution_type: bySolution.recordset,
        trend_data: trendData.recordset,
        tickets_this_month: monthRes[0]?.resolved ?? 0,
        tickets_this_week: weekRes[0]?.resolved ?? 0,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

// src/utils/ticketWatcher.js
//-------------------------------------------------------------------
// TicketWatcher – proceso que revisa y corrige el estado de los tickets
//-------------------------------------------------------------------
const Ticket = require('../models/Ticket');
const { TicketStatus } = require('../utils/constants');

/**
 * @class TicketWatcher
 * @param {number} intervalMs   – Intervalo en milisegundos entre revisiones.
 * @param {WebSocketServer} wss – (opcional) instancia WS para broadcast.
 */
class TicketWatcher {
  constructor(intervalMs = 5000, wss = null) {
    this.intervalMs = intervalMs;
    this.wss = wss;
    this.timer = null;
    this.isRunning = false;
  }

  /** Revisa los tickets y corrige incoherencias. */
  async _checkAndFix() {
    try {
      // 1️⃣  Traer tickets no eliminados
      const tickets = await Ticket.findAll({ deleted: false }, { role: 'admin' });

      const broken = tickets.filter(
        (t) =>
          // asignado sin técnico
          (t.status === TicketStatus.ASSIGNED && !t.assigned_to) ||
          // en proceso sin técnico
          (t.status === TicketStatus.IN_PROGRESS && !t.assigned_to) ||
          // resuelto sin solución ni tipo
          (t.status === TicketStatus.RESOLVED && (!t.solution || !t.solution_type_id))
      );

      if (broken.length === 0) return;

      for (const t of broken) {
        const payload = {};

        if (t.status === TicketStatus.ASSIGNED && !t.assigned_to) {
          payload.status = TicketStatus.NEW;
        }

        if (t.status === TicketStatus.IN_PROGRESS && !t.assigned_to) {
          payload.status = TicketStatus.NEW;
          
        }

        if (t.status === TicketStatus.RESOLVED && (!t.solution || !t.solution_type_id)) {
          payload.status = TicketStatus.IN_PROGRESS;
        
        }

        if (Object.keys(payload).length) {
          await Ticket.updateTicket(t.id, payload);
          // Broadcast WS si está disponible
          if (this.wss) {
            const msg = JSON.stringify({
              type: 'TICKET_STATUS_UPDATE',
              payload: { id: t.id, ...payload },
            });
            this.wss.clients.forEach((c) => {
              if (c.readyState === c.OPEN) c.send(msg);
            });
          }
        }
      }
    } catch (err) {
      console.error('❌  Error en TicketWatcher:', err);
    }
  }

  /** Inicia el intervalo. */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => this._checkAndFix(), this.intervalMs);
    console.info(`🕒 TicketWatcher iniciado (cada ${this.intervalMs} ms)`);
    // Primera ejecución inmediata
    this._checkAndFix();
  }

  /** Detiene el intervalo. */
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.isRunning = false;
  }

  /**
   * Llamado cuando alguien toma un ticket → notifica vía WS y vuelve a validar.
   * @param {string} ticketId
   */
  async notifyTicketTaken(ticketId) {
    const ticket = await Ticket.findById(ticketId);
    if (ticket && this.wss) {
      const msg = JSON.stringify({
        type: 'TICKET_TAKEN',
        payload: {
          id: ticket.id,
          assigned_to: ticket.assigned_to,
          status: ticket.status,
        },
      });
      this.wss.clients.forEach((c) => {
        if (c.readyState === c.OPEN) c.send(msg);
      });
    }
    // Opcional: otra validación ligera
    await this._checkAndFix();
  }
}

module.exports = TicketWatcher;

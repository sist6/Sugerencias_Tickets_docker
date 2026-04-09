// wsBroadcaster.js
/**
 * Módulo que expone una función estática para enviar mensajes a
 * los sockets WebSocket conectados.
 *
 * Se basa en la instancia global `global.wss` creada en server.js.
 */

class WsBroadcaster {
  /**
   * Envía `payload` (objeto JSON) a los clientes WebSocket.
   *
   * @param {Object} payload            Objeto que será `JSON.stringify`‑ado.
   * @param {Array<string>} [targetUserIds]  Si se especifica, sólo los sockets cuyo `userId` está en la lista recibirán el mensaje.
   * @param {Function} [filterFn]           Función opcional de filtro (socket) => boolean.
   */
  static broadcast(payload, targetUserIds = null, filterFn = null) {
    if (!global.wss) {
      console.warn(
        '⚠️  wsBroadcaster.broadcast() llamado antes de que el WS esté listo'
      );
      return;
    }

    const message = JSON.stringify(payload);

    // 1️⃣  Sólo sockets abiertos
    let clients = Array.from(global.wss.clients).filter(
      (client) => client.readyState === client.OPEN
    );

    // 2️⃣  Si se pasó una lista de usuarios, filtramos por ella
    if (Array.isArray(targetUserIds) && targetUserIds.length) {
      clients = clients.filter(
        (client) => client.userId && targetUserIds.includes(client.userId)
      );
    }

    // 3️⃣  Filtro custom (p.ej. por rol, por proyecto, etc.)
    if (typeof filterFn === 'function') {
      clients = clients.filter(filterFn);
    }

    // 4️⃣  Envío
    clients.forEach((client) => {
      try {
        client.send(message);
      } catch (e) {
        console.error('❌ Error enviando broadcast WS', e);
      }
    });
  }
}

module.exports = WsBroadcaster;

// src/models/TicketType.js
/**
 * Modelo de Tipo de Ticket
 * Tabla: ticket_types
 */

const { generateId, formatDateForSQL } = require('../utils/helpers');
const { isDBConnected, executeQuery } = require('../config/db');

const store = new Map();

/* ---------- CRUD ---------- */

async function findAll() {
  if (isDBConnected()) {
    const result = await executeQuery(`SELECT * FROM ticket_types ORDER BY name`);
    return result.recordset;
  }
  return Array.from(store.values());
}

async function findById(id) {
  if (isDBConnected()) {
    const result = await executeQuery(`SELECT * FROM ticket_types WHERE id = @id`, { id });
    return result.recordset[0] || null;
  }
  return store.get(id) || null;
}

async function create(data) {
  const tt = {
    id: generateId(),
    name: data.name,
    description: data.description || '',
    default_priority: data.default_priority || 'medium',
    created_at: formatDateForSQL(),
    updated_at: formatDateForSQL(),
  };

  if (isDBConnected()) {
    await executeQuery(
      `INSERT INTO ticket_types (id, name, description, default_priority, created_at, updated_at)
       VALUES (@id, @name, @description, @default_priority, @created_at, @updated_at)`,
      tt
    );
  } else {
    store.set(tt.id, tt);
  }
  return tt;
}

async function update(id, data) {
  if (isDBConnected()) {
    const set = [];
    const params = { id };

    if (data.name !== undefined) {
      set.push('name = @name');
      params.name = data.name;
    }
    if (data.description !== undefined) {
      set.push('description = @description');
      params.description = data.description;
    }
    if (data.default_priority !== undefined) {
      set.push('default_priority = @default_priority');
      params.default_priority = data.default_priority;
    }
    if (set.length === 0) return findById(id);

    set.push('updated_at = @updated_at');
    params.updated_at = formatDateForSQL();

    await executeQuery(
      `UPDATE ticket_types SET ${set.join(', ')} WHERE id = @id`,
      params
    );
  } else {
    const tt = store.get(id);
    if (tt) {
      if (data.name !== undefined) tt.name = data.name;
      if (data.description !== undefined) tt.description = data.description;
      if (data.default_priority !== undefined) tt.default_priority = data.default_priority;
      tt.updated_at = formatDateForSQL();
    }
  }
  return findById(id);
}

async function remove(id) {
  if (isDBConnected()) {
    await executeQuery(`DELETE FROM ticket_types WHERE id = @id`, { id });
  } else {
    store.delete(id);
  }
}

/* ---------- EXPORT ---------- */
module.exports = {
  findAll,
  findById,
  create,
  update,
  delete: remove,
};

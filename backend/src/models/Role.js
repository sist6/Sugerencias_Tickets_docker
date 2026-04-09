// src/models/Role.js
/**
 * Modelo de Rol
 * Tabla: roles
 */

const { generateId, formatDateForSQL } = require('../utils/helpers');
const { isDBConnected, executeQuery } = require('../config/db');

const store = new Map();

/* ---------- CRUD ---------- */
async function findAll() {
  if (isDBConnected()) {
    const result = await executeQuery(`SELECT * FROM roles ORDER BY name`);
    return result.recordset;
  }
  return Array.from(store.values());
}

async function findById(id) {
  if (isDBConnected()) {
    const result = await executeQuery(`SELECT * FROM roles WHERE id = @id`, { id });
    return result.recordset[0] || null;
  }
  return store.get(id) || null;
}

async function create(data) {
  const role = {
    id: generateId(),
    name: data.name,
    description: data.description || '',
    permissions: data.permissions ? JSON.stringify(data.permissions) : null,
    created_at: formatDateForSQL(),
    updated_at: formatDateForSQL(),
  };

  if (isDBConnected()) {
    await executeQuery(
      `INSERT INTO roles (id, name, description, permissions, created_at, updated_at)
       VALUES (@id, @name, @description, @permissions, @created_at, @updated_at)`,
      role
    );
  } else {
    store.set(role.id, role);
  }
  return role;
}

async function remove(id) {
  if (isDBConnected()) {
    await executeQuery(`DELETE FROM roles WHERE id = @id`, { id });
  } else {
    store.delete(id);
  }
}

/* ---------- EXPORT ---------- */
module.exports = {
  findAll,
  findById,
  create,
  delete: remove,
};

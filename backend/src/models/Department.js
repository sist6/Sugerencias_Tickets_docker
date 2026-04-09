// src/models/Department.js
/**
 * Modelo de Departamento
 * Tabla: departments
 *
 * - Cuando la base de datos está conectada (`isDBConnected()`),
 *   se ejecutan consultas reales contra SQL Server.
 * - Si la BD no está disponible, se usa un almacenamiento en memoria
 *   (`Map`) para que la API siga funcionando en modo “development”.
 */

const { generateId, formatDateForSQL } = require('../utils/helpers');
const { isDBConnected, executeQuery } = require('../config/db');

// Almacén en memoria (solo para modo sin BD)
const store = new Map();

/* -------------------- CRUD -------------------- */

/**
 * Obtiene todos los departamentos.
 * @returns {Promise<Array>}
 */
async function findAll() {
  if (isDBConnected()) {
    const result = await executeQuery(
      `SELECT id, name, description, created_at, updated_at
       FROM departments
       ORDER BY name`
    );
    return result.recordset;
  }
  // Memoria
  return Array.from(store.values());
}

/**
 * Busca un departamento por su id.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  if (isDBConnected()) {
    const result = await executeQuery(
      `SELECT id, name, description, created_at, updated_at
       FROM departments
       WHERE id = @id`,
      { id }
    );
    return result.recordset[0] || null;
  }
  return store.get(id) || null;
}

/**
 * Crea un nuevo departamento.
 * @param {Object} data  { name, description? }
 * @returns {Promise<Object>}
 */
async function create(data) {
  const dep = {
    id: generateId(),
    name: data.name,
    description: data.description || '',
    created_at: formatDateForSQL(),
    updated_at: formatDateForSQL(),
  };

  if (isDBConnected()) {
    await executeQuery(
      `INSERT INTO departments (id, name, description, created_at, updated_at)
       VALUES (@id, @name, @description, @created_at, @updated_at)`,
      dep
    );
  } else {
    store.set(dep.id, dep);
  }
  return dep;
}

/**
 * Actualiza un departamento existente.
 * Sólo actualiza los campos enviados (name, description).
 * @param {string} id
 * @param {Object} data  { name?, description? }
 * @returns {Promise<Object|null>}
 */
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

    // Si no hay nada que actualizar, devolvemos el registro tal cual
    if (set.length === 0) return findById(id);

    set.push('updated_at = @updated_at');
    params.updated_at = formatDateForSQL();

    const setClause = set.join(', ');
    await executeQuery(
      `UPDATE departments SET ${setClause} WHERE id = @id`,
      params
    );
  } else {
    const dep = store.get(id);
    if (dep) {
      if (data.name !== undefined) dep.name = data.name;
      if (data.description !== undefined) dep.description = data.description;
      dep.updated_at = formatDateForSQL();
    }
  }
  return findById(id);
}

/**
 * Elimina un departamento.
 * @param {string} id
 * @returns {Promise<void>}
 */
async function remove(id) {
  if (isDBConnected()) {
    await executeQuery(`DELETE FROM departments WHERE id = @id`, { id });
  } else {
    store.delete(id);
  }
}

/* -------------------- EXPORT -------------------- */
module.exports = {
  findAll,
  findById,
  create,
  update,
  delete: remove,
};

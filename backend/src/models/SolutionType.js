// src/models/SolutionType.js
const { executeQuery } = require('../config/db');
const { generateId } = require('../utils/helpers');

// -------------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------------
/**
 * Convierte el valor almacenado en la columna `incident_type_ids`
 * (NVARCHAR) a un array JavaScript.  Si es NULL o no es JSON válido
 * devuelve [].
 */
const parseIncidentIds = (raw) => {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    // aseguramos que sea un array de strings
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch (_) {
    return [];
  }
};

/**
 * Prepara la cadena JSON que se guardará en la tabla.
 * Si el array está vacío guarda NULL (el CHECK anterior lo permite).
 */
const stringifyIncidentIds = (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  return JSON.stringify(ids);
};

// -------------------------------------------------------------------
// CRUD
// -------------------------------------------------------------------
async function getAll() {
  const res = await executeQuery(`
    SELECT id,
           name,
           description,
           incident_type_ids,
           created_at,
           updated_at,
           deleted
    FROM dbo.solution_types
    WHERE deleted = 0
  `);

  // Transformamos la columna JSON a array
  return (res.recordset || []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    incident_type_ids: parseIncidentIds(row.incident_type_ids),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted: row.deleted,
  }));
}

async function create(data) {
  const id = generateId();

  await executeQuery(
    `INSERT INTO dbo.solution_types
       (id, name, description, incident_type_ids, deleted)
     VALUES
       (@id, @name, @description, @incident_type_ids, 0)`,
    {
      id,
      name: data.name,
      description: data.description ?? null,
      incident_type_ids: stringifyIncidentIds(data.incident_type_ids),
    }
  );

  return {
    id,
    name: data.name,
    description: data.description ?? null,
    incident_type_ids: data.incident_type_ids ?? [],
    deleted: 0,
  };
}

/**
 * `data` puede contener:
 *   - name
 *   - description
 *   - incident_type_ids (array)
 *
 * Sólo actualizamos los campos que realmente recibimos.
 */
async function update(id, data) {
  const fields = [];
  const params = { id };

  if (data.name !== undefined) {
    fields.push('name = @name');
    params.name = data.name;
  }
  if (data.description !== undefined) {
    fields.push('description = @description');
    params.description = data.description;
  }
  if (data.incident_type_ids !== undefined) {
    fields.push('incident_type_ids = @incident_type_ids');
    params.incident_type_ids = stringifyIncidentIds(data.incident_type_ids);
  }

  if (fields.length === 0) return; // nada que actualizar

  await executeQuery(
    `UPDATE dbo.solution_types
      SET ${fields.join(', ')}
     WHERE id = @id`,
    params
  );
}

/**
 * “Borrar” lógicamente: marcamos `deleted = 1`.
 */
async function deleteType(id) {
  await executeQuery(
    `UPDATE dbo.solution_types SET deleted = 1 WHERE id = @id`,
    { id }
  );
}

// -------------------------------------------------------------------
// EXPORTS
// -------------------------------------------------------------------
module.exports = {
  getAll,
  create,
  update,
  delete: deleteType,
};

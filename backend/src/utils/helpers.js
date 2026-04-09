/**
 * Utilidades de ayuda
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Genera un UUID v4
 */
function generateId() {
  return uuidv4();
}
/**
 * Valida si una cadena tiene formato GUID (UUID‑v4)
 */
function isValidUUID(str) {
  if (typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function ensureGuid(name, value) {
  if (value === undefined || value === null) return; // permite null
  if (!isValidUUID(value)) {
    const err = new Error(`"${name}" debe ser un GUID (ej. 3F2504E0-4F89-11D3-9A0C-0305E82C3301).`);
    err.status = 400;
    throw err;
  }
}

/**
 * Formatea fecha para SQL Server
 */
function formatDateForSQL(date = new Date()) {
  return date.toISOString();
}

/**
 * Parsea un array JSON desde SQL Server
 */
function parseJSONArray(value) {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

/**
 * Convierte array a JSON string para SQL Server
 */
function arrayToJSON(arr) {
  return JSON.stringify(arr || []);
}

/**
 * Sanitiza un objeto removiendo campos undefined
 */
function sanitizeObject(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Convierte resultado de SQL Server a objeto limpio
 */
function recordsetToObjects(recordset) {
  return recordset.map(row => {
    const obj = { ...row };
    // Parsear campos JSON si existen
    if (obj.hotel_ids) obj.hotel_ids = parseJSONArray(obj.hotel_ids);
    if (obj.permissions) obj.permissions = parseJSONArray(obj.permissions);
    if (obj.department_ids) obj.department_ids = parseJSONArray(obj.department_ids);
    if (obj.user_ids) obj.user_ids = parseJSONArray(obj.user_ids);
    if (obj.comments) obj.comments = parseJSONArray(obj.comments);
    return obj;
  });
}

module.exports = {
  generateId,
  formatDateForSQL,
  parseJSONArray,
  arrayToJSON,
  sanitizeObject,
  recordsetToObjects,
  isValidUUID,
  ensureGuid,
};

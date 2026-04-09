// src/lib/cache.js
/**
 * Simple wrapper sobre localStorage que permite guardar un objeto
 * con expiración (TTL).
 *
 * Cada entrada queda como:
 * {
 *   data: <valor>,
 *   meta: {
 *     version: <string|number>, // opcional, sirve para comparar con el backend
 *     storedAt: <timestamp ms>
 *   }
 * }
 */

const CACHE_PREFIX = "ticket_app_";

/**
 * @param {string} key      // clave sin prefijo
 * @param {any}    value    // objeto que se guardará (se JSON.stringify)
 * @param {object} options  { ttl?: number (ms), version?: any }
 */
export const setCache = (key, value, options = {}) => {
  const entry = {
    data: value,
    meta: {
      version: options.version ?? null,
      storedAt: Date.now(),
      ttl: options.ttl ?? null,
    },
  };
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (e) {
    console.warn("⚠️  No se pudo escribir en localStorage", e);
  }
};

/**
 * @param {string} key
 * @returns {null|{data:any, meta:{version:any, storedAt:number, ttl:number|null}}}
 */
export const getCache = (key) => {
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    // Si tiene TTL y ya expiró → lo borramos
    if (entry.meta?.ttl && Date.now() - entry.meta.storedAt > entry.meta.ttl) {
      window.localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry;
  } catch (e) {
    console.warn("⚠️  Error leyendo cache", e);
    return null;
  }
};

/** elimina la entrada */
export const deleteCache = (key) => {
  try {
    window.localStorage.removeItem(CACHE_PREFIX + key);
  } catch (e) {
    console.warn("⚠️  No se pudo eliminar cache", e);
  }
};

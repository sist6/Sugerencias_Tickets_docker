// backend/src/utils/fuzzy.js

/**
 * Normaliza nombres de hoteles para que “SB Granada” y
 * “Soho Boutique Granada” coincidan.
 *
 *  - pasa a minúsculas
 *  - elimina prefijos comunes: "sb ", "soho boutique ", "soho "
 *  - quita tildes y caracteres especiales
 */
function normalizeName(name) {
  if (!name) return "";

  // eliminar acentos (á → a, í → i, …)
  const sinAcentos = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const lower = sinAcentos.toLowerCase().trim();

  // Prefijos que consideramos equivalentes
  const prefixes = [
    "sb ",
    "soho boutique ",
    "soho ",
    "hotel ",
    "aptos. ",
    "itc ",
    "i t c ", // por si alguien escribe con espacios
  ];

  let normalized = lower;
  prefixes.forEach(p => {
    if (normalized.startsWith(p)) {
      normalized = normalized.substring(p.length);
    }
  });

  return normalized.trim();
}

module.exports = { normalizeName };

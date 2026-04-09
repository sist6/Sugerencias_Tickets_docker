// backend/src/utils/hotelsData.js
const { readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { normalizeName } = require("./fuzzy");

// Ruta absoluta del JSON (en utils/hoteles.json)
const JSON_PATH = path.join(__dirname, "hoteles.json");

/* ---------- Lectura ---------- */
async function loadHotels() {
  const raw = await readFile(JSON_PATH, "utf8");
  const data = JSON.parse(raw);

  // Aseguramos que cada hotel tenga un id numérico
  let maxId = data.reduce((m, h) => Math.max(m, Number(h.id) || 0), 0);
  data.forEach(h => {
    if (!h.id) {
      maxId += 1;
      h.id = maxId;
    }
  });
  return data;
}

/* ---------- Escritura ---------- */
async function saveHotels(arr) {
  const json = JSON.stringify(arr, null, 2);
  await writeFile(JSON_PATH, json, "utf8");
}

/* ---------- Búsqueda por ID ---------- */
async function findById(id) {
  const list = await loadHotels();
  return list.find(h => String(h.id) === String(id));
}

/* ---------- Búsqueda fuzzy por nombre ---------- */
async function findByName(query) {
  const normalizedQuery = normalizeName(query);
  const list = await loadHotels();

  if (!normalizedQuery) return list; // sin filtro devuelve todo

  return list.filter(h => {
    const normalizedHotel = normalizeName(h.Hotel ?? "");
    return normalizedHotel.includes(normalizedQuery);
  });
}

/* ---------- CREATE ---------- */
async function createHotel(data) {
  const list = await loadHotels();
  const nextId = list.reduce((m, h) => Math.max(m, Number(h.id) || 0), 0) + 1;
  const nuevo = { id: nextId, ...data };
  list.push(nuevo);
  await saveHotels(list);
  return nuevo;
}

/* ---------- UPDATE ---------- */
async function updateHotel(id, updates) {
  const list = await loadHotels();
  const idx = list.findIndex(h => String(h.id) === String(id));
  if (idx === -1) return null;
  const hotel = { ...list[idx], ...updates };
  list[idx] = hotel;
  await saveHotels(list);
  return hotel;
}

/* ---------- DELETE ---------- */
async function deleteHotel(id) {
  const list = await loadHotels();
  const filtered = list.filter(h => String(h.id) !== String(id));
  if (filtered.length === list.length) return false; // nada que borrar
  await saveHotels(filtered);
  return true;
}

/* ---------- Export ---------- */
module.exports = {
  loadHotels,
  findById,
  findByName,
  createHotel,
  updateHotel,
  deleteHotel,
  saveHotels,
};

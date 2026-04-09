// backend/src/routes/maphotels.routes.js
const { Router } = require("express");
const {
  loadHotels,
  findById,
  findByName,
  createHotel,
  updateHotel,
  deleteHotel,
} = require("../utils/hotelsData");
const { authenticateToken } = require("../middleware/auth");
const { requireRoles } = require("../middleware/roles");

const router = Router();

/* -----------------------------------------------------------------
   GET /api/map-hotels
   - ?search=texto → búsqueda fuzzy por nombre
   - sin query → devuelve todos los hoteles
   ----------------------------------------------------------------- */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { search } = req.query;
    const result = await findByName(search ?? "");
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo hoteles" });
  }
});

/* -----------------------------------------------------------------
   GET /api/map-hotels/:id
   ----------------------------------------------------------------- */
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const hotel = await findById(req.params.id);
    if (!hotel) return res.status(404).json({ error: "Hotel no encontrado" });
    res.json(hotel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo hotel" });
  }
});

/* -----------------------------------------------------------------
   POST /api/map-hotels   (solo admin)
   ----------------------------------------------------------------- */
router.post(
  "/",
  authenticateToken,
  requireRoles(["admin"]),
  async (req, res) => {
    try {
      const nuevo = await createHotel(req.body);
      res.status(201).json(nuevo);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error creando hotel" });
    }
  }
);

/* -----------------------------------------------------------------
   PUT /api/map-hotels/:id   (solo admin)
   ----------------------------------------------------------------- */
router.put(
  "/:id",
  authenticateToken,
  requireRoles(["admin"]),
  async (req, res) => {
    try {
      const actualizado = await updateHotel(req.params.id, req.body);
      if (!actualizado)
        return res.status(404).json({ error: "Hotel no encontrado" });
      res.json(actualizado);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error actualizando hotel" });
    }
  }
);

/* -----------------------------------------------------------------
   DELETE /api/map-hotels/:id   (solo admin)
   ----------------------------------------------------------------- */
router.delete(
  "/:id",
  authenticateToken,
  requireRoles(["admin"]),
  async (req, res) => {
    try {
      const ok = await deleteHotel(req.params.id);
      if (!ok) return res.status(404).json({ error: "Hotel no encontrado" });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error borrando hotel" });
    }
  }
);

module.exports = router;

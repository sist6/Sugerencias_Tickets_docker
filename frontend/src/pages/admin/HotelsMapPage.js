// src/pages/admin/HotelsMapPage.jsx
import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { Helmet } from "react-helmet-async";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ---------- MARKER‑CLUSTER ---------- */
import "leaflet.markercluster/dist/leaflet.markercluster.js";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

/* ---------- ICONOS ---------- */
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

/* ---------- API ---------- */
import { mapHotelsAPI as hotelsAPI } from "../../lib/api";

/* ------------------------------------------------------------------
   CONFIGURACIÓN DE ICONOS DE LEAFLET
   ------------------------------------------------------------------ */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/* ------------------------------------------------------------------
   HELPERS
   ------------------------------------------------------------------ */
function toClientShape(raw) {
  return {
    id: raw.id,
    name: raw.Hotel,
    address: raw.Direccion,
    lat: Number(raw.Lat),
    lng: Number(raw.Lng),
    phone: raw.Telf,
    email: raw.Email,
    director: raw.Director,
    directorEmail: raw.EmailDirec,
    zoneDirector: raw["Director Zona"],
    zoneEmail: raw["Email Zona"],
    directorPhone: raw["Telf Director"] ?? "",
    zonePhone: raw["Telf Zona"] ?? "",
  };
}
function toBackendShape(client) {
  return {
    Hotel: client.name,
    Direccion: client.address,
    Lat:
      client.lat !== "" && client.lat !== undefined
        ? Number(client.lat)
        : undefined,
    Lng:
      client.lng !== "" && client.lng !== undefined
        ? Number(client.lng)
        : undefined,
    Telf: client.phone,
    Email: client.email,
    Director: client.director,
    EmailDirec: client.directorEmail,
    "Director Zona": client.zoneDirector,
    "Email Zona": client.zoneEmail,
    "Telf Director": client.directorPhone,
    "Telf Zona": client.zonePhone,
  };
}
function getCity(address = "") {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    const country = parts[parts.length - 1];
    if (country.includes("España") || country.includes("Marruecos")) {
      return parts[parts.length - 2];
    }
  }
  return parts[parts.length - 1] || "";
}

/* ------------------------------------------------------------------
   COMPONENTE PRINCIPAL – HotelsMapPage
   ------------------------------------------------------------------ */
export default function HotelsMapPage() {
  /* ---------- REFS ---------- */
  const mapRef = useRef(null);
  const clusterRef = useRef(null);
  const markerRefs = useRef({});

  /* ---------- STATE ---------- */
  const [hoteles, setHoteles] = useState([]);
  const [filters, setFilters] = useState({
    hotel: "",
    director: "",
    zonaDirector: "",
    ciudad: "",
  });
  const [editingHotel, setEditingHotel] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const preselected = searchParams.get("hotel")?.trim() ?? "";

  /* ---------- OPCIONES DEPENDIENTES DE LOS FILTROS ---------- */
  const hotelOptions = useMemo(() => {
    const set = new Set();
    hoteles.forEach((h) => {
      const city = getCity(h.address).toLowerCase();
      const matchesOtherFilters =
        (!filters.director ||
          (h.director || "")
            .toLowerCase()
            .includes(filters.director.toLowerCase())) &&
        (!filters.zonaDirector ||
          (h.zoneDirector || "")
            .toLowerCase()
            .includes(filters.zonaDirector.toLowerCase())) &&
        (!filters.ciudad || city.includes(filters.ciudad.toLowerCase()));
      if (matchesOtherFilters && h.name) set.add(h.name);
    });
    return Array.from(set).sort();
  }, [hoteles, filters.director, filters.zonaDirector, filters.ciudad]);

  const directorOptions = useMemo(() => {
    const set = new Set();
    hoteles.forEach((h) => {
      const city = getCity(h.address).toLowerCase();
      const matchesOtherFilters =
        (!filters.hotel ||
          (h.name || "").toLowerCase().includes(filters.hotel.toLowerCase())) &&
        (!filters.zonaDirector ||
          (h.zoneDirector || "")
            .toLowerCase()
            .includes(filters.zonaDirector.toLowerCase())) &&
        (!filters.ciudad || city.includes(filters.ciudad.toLowerCase()));
      if (matchesOtherFilters && h.director) set.add(h.director);
    });
    return Array.from(set).sort();
  }, [hoteles, filters.hotel, filters.zonaDirector, filters.ciudad]);

  const zonaOptions = useMemo(() => {
    const set = new Set();
    hoteles.forEach((h) => {
      const city = getCity(h.address).toLowerCase();
      const matchesOtherFilters =
        (!filters.hotel ||
          (h.name || "").toLowerCase().includes(filters.hotel.toLowerCase())) &&
        (!filters.director ||
          (h.director || "").toLowerCase().includes(filters.director.toLowerCase())) &&
        (!filters.ciudad || city.includes(filters.ciudad.toLowerCase()));
      if (matchesOtherFilters && h.zoneDirector) set.add(h.zoneDirector);
    });
    return Array.from(set).sort();
  }, [hoteles, filters.hotel, filters.director, filters.ciudad]);

  const cityOptions = useMemo(() => {
    const set = new Set();
    hoteles.forEach((h) => {
      const city = getCity(h.address);
      const matchesOtherFilters =
        (!filters.hotel ||
          (h.name || "").toLowerCase().includes(filters.hotel.toLowerCase())) &&
        (!filters.director ||
          (h.director || "").toLowerCase().includes(filters.director.toLowerCase())) &&
        (!filters.zonaDirector ||
          (h.zoneDirector || "")
            .toLowerCase()
            .includes(filters.zonaDirector.toLowerCase()));
      if (matchesOtherFilters && city) set.add(city);
    });
    return Array.from(set).sort();
  }, [hoteles, filters.hotel, filters.director, filters.zonaDirector]);

  /* ---------- CARGA DE DATOS ---------- */
  useEffect(() => {
    (async () => {
      try {
        const raw = await hotelsAPI.getAll();
        setHoteles(raw.map(toClientShape));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  /* ---------- PRE‑SELECCIÓN DESDE LA URL ---------- */
  useEffect(() => {
    if (!preselected) return;
    if (!hoteles.length) return;
    const found = hoteles.find(
      (h) => h.name?.toLowerCase() === preselected.toLowerCase()
    );
    if (found) {
      setFilters({
        hotel: found.name,
        director: "",
        zonaDirector: "",
        ciudad: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselected, hoteles]);

  /* ---------- INICIALIZAR EL MAPA ---------- */
  useEffect(() => {
    if (mapRef.current) return;

    const spainBounds = L.latLngBounds(L.latLng(27.0, -9.5), L.latLng(44.0, 4.0)).pad(0.15);

    const map = L.map("leafletMap", {
      center: [40.4168, -3.7038],
      zoom: 6,
      maxBounds: spainBounds,
      maxBoundsViscosity: 0.8,
      worldCopyJump: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      noWrap: true,
    }).addTo(map);

    mapRef.current = map;
    clusterRef.current = L.markerClusterGroup();
    map.addLayer(clusterRef.current);
  }, []);

  /* ---------- AJUSTE DE TAMAÑO AL REDIMENSIONAR ---------- */
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) mapRef.current.invalidateSize();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* ---------- FILTRADO DE HOTELS ---------- */
  const filteredHotels = useMemo(() => {
    return hoteles.filter((h) => {
      const ciudad = getCity(h.address).toLowerCase();
      return (
        (!filters.hotel ||
          (h.name || "").toLowerCase().includes(filters.hotel.toLowerCase())) &&
        (!filters.director ||
          (h.director || "").toLowerCase().includes(filters.director.toLowerCase())) &&
        (!filters.zonaDirector ||
          (h.zoneDirector || "")
            .toLowerCase()
            .includes(filters.zonaDirector.toLowerCase())) &&
        (!filters.ciudad || ciudad.includes(filters.ciudad.toLowerCase()))
      );
    });
  }, [hoteles, filters]);

  /* ---------- DIBUJAR MARCADORES + DESPLAZAMIENTO AUTOMÁTICO ---------- */
  useEffect(() => {
    if (!clusterRef.current) return;

    // 1️⃣ Limpiar capa de clúster y referencias
    clusterRef.current.clearLayers();
    markerRefs.current = {};

    // 2️⃣ Crear marcadores
    filteredHotels.forEach((h) => {
      if (!h.lat || !h.lng) return;

      const popupContent = `
        <div class="max-w-sm md:max-w-md lg:max-w-lg w-full">
          <div class="p-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-md text-gray-800 max-h-[400px] overflow-y-auto">
            <h3 class="text-lg font-semibold flex items-center mb-2"><span class="mr-1">🏨</span>${h.name}</h3>
            ${h.address ? `<p class="flex items-center"><span class="mr-1">📍</span><b>Dirección:</b> ${h.address}</p>` : ""}
            ${h.phone ? `<p class="flex items-center"><span class="mr-1">📞</span><b>Teléfono:</b> ${h.phone}</p>` : ""}
            ${h.email ? `<p class="flex items-center"><span class="mr-1">✉️</span><b>Email:</b> ${h.email}</p>` : ""}
            <hr class="my-2"/>
            ${h.director ? `<p class="flex items-center"><span class="mr-1">👤</span><b>Director/a:</b> ${h.director}</p>` : ""}
            ${h.directorPhone ? `<p class="flex items-center"><span class="mr-1">📞</span><b>Tel. Director:</b> ${h.directorPhone}</p>` : ""}
            ${h.directorEmail ? `<p class="flex items-center"><span class="mr-1">📧</span><b>Email Director/a:</b> ${h.directorEmail}</p>` : ""}
            ${h.zoneDirector ? `<p class="flex items-center"><span class="mr-1">🗺️</span><b>Director Zona:</b> ${h.zoneDirector}</p>` : ""}
            ${h.zonePhone ? `<p class="flex items-center"><span class="mr-1">📞</span><b>Tel. Zona:</b> ${h.zonePhone}</p>` : ""}
            ${h.zoneEmail ? `<p class="flex items-center"><span class="mr-1">📧</span><b>Email Zona:</b> ${h.zoneEmail}</p>` : ""}
            <button class="edit-btn mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 rounded transition" data-id="${h.id}">
              Editar
            </button>
          </div>
        </div>
      `;

      const marker = L.marker([h.lat, h.lng]).bindPopup(popupContent, {
        autoPan: true,
        autoPanPaddingTopLeft: [30, 30],
        autoPanPaddingBottomRight: [30, 30],
      });

      clusterRef.current.addLayer(marker);
      markerRefs.current[h.id] = marker;
    });

    // 3️⃣ Si hay filtro de hotel exacto, centrar y abrir popup
    if (filters.hotel) {
      const target = filteredHotels.find(
        (h) => h.name?.toLowerCase() === filters.hotel?.toLowerCase()
      );
      if (target && markerRefs.current[target.id] && mapRef.current) {
        const marker = markerRefs.current[target.id];
        clusterRef.current.zoomToShowLayer(marker, () => {
          mapRef.current.setView([target.lat, target.lng], 14);
          marker.openPopup();
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredHotels, filters.hotel]);

  /* ---------- ESCUCHAR CLICK EN “EDITAR” ---------- */
  useEffect(() => {
    const handler = (e) => {
      const btn = e.target.closest(".edit-btn");
      if (!btn) return;
      const id = btn.dataset.id;
      const hotel = hoteles.find((h) => String(h.id) === id);
      if (hotel) setEditingHotel(hotel);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [hoteles]);

  /* ---------- ESTILOS BASE DE INPUT ---------- */
  const baseInputCls =
    "block w-full bg-white/70 border border-gray-300 rounded-lg py-2 pl-3 pr-8 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition";

  /* ---------- COMPONENTE AUTOCOMPLETE ---------- */
  const Autocomplete = ({
    placeholder,
    value,
    onChange,
    options,
  }) => {
    // -------------------------------------------------------------
    // 1️⃣ Estado interno con lo que el usuario escribe
    // -------------------------------------------------------------
    const [inputValue, setInputValue] = useState(value ?? "");
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

    // Sincroniza con el valor externo (por ejemplo, al Reset)
    useEffect(() => {
      setInputValue(value ?? "");
    }, [value]);

    // Lista de opciones que coinciden con lo escrito
    const filtered = useMemo(() => {
      const lower = inputValue?.toLowerCase?.() ?? "";
      return options.filter((opt) => opt.toLowerCase().includes(lower));
    }, [inputValue, options]);

    // Cuando el usuario escribe → solo actualizamos el input interno
    const handleInput = (e) => {
      setInputValue(e.target.value);
      if (!open) setOpen(true);
    };

    // Cuando se elige una opción del dropdown → actualizamos el input
    // visible y notificamos al padre con onChange (que disparará el filtro)
    const handleSelect = (opt) => {
      setInputValue(opt);
      onChange(opt);
      setOpen(false);
    };

    // -------------------------------------------------------------
    // 2️⃣ Cerrar el dropdown al hacer click fuera del componente
    // -------------------------------------------------------------
    useEffect(() => {
      const outside = (e) => {
        if (containerRef.current && !containerRef.current.contains(e.target)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", outside);
      return () => document.removeEventListener("mousedown", outside);
    }, []);

    // -------------------------------------------------------------
    // 3️⃣ Posicionar el dropdown bajo el input
    // -------------------------------------------------------------
    useEffect(() => {
      if (open && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setPos({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    }, [open, filtered]);

    return (
      <div className="relative w-full" ref={containerRef}>
        <input
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          className={baseInputCls}
          ref={inputRef}
        />
        {open &&
          createPortal(
            <ul
               className={`
              bg-white dark:bg-gray-800               /* fondo */
              border border-gray-300 dark:border-gray-600 /* borde */
              rounded-md shadow-lg
              max-h-60 overflow-y-auto
            `}
              style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                width: pos.width,
                zIndex: 2000,
              }}
            >
              {filtered.length > 0 ? (
                filtered.map((opt) => (
                  <li
                    key={opt}
                     className={`
                    px-3 py-2 cursor-pointer
                    text-gray-800 dark:text-gray-200    /* color del texto */
                    hover:bg-gray-100 dark:hover:bg-gray-700 /* hover */
                  `}
                  onMouseDown={(e) => {
                    e.preventDefault(); // evita que el input pierda foco antes del click
                    handleSelect(opt);
                  }}
                  >
                    {opt}
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-gray-500">Sin resultados</li>
              )}
            </ul>,
            document.body
          )}
      </div>
    );
  };

  /* ---------- MANEJO DE CAMBIOS EN LOS FILTROS ---------- */
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };
  const handleHotelChange = (value) => {
    const hotel = hoteles.find((h) => h.name === value);
    const newHotelName = hotel ? hotel.name : value;

    // 1️⃣ Actualizar filtro interno
    setFilters((prev) => ({
      ...prev,
      hotel: newHotelName,
    }));

    // 2️⃣ Actualizar query‑string
    if (newHotelName && newHotelName.trim() !== "") {
      setSearchParams({ hotel: newHotelName });
    } else {
      setSearchParams({});
    }
  };
  const resetAll = () => {
    setFilters({ hotel: "", director: "", zonaDirector: "", ciudad: "" });
    setSearchParams({});
    if (mapRef.current) mapRef.current.setView([40.4168, -3.7038], 6);
  };
  const handleNewHotel = () => {
    setEditingHotel({
      id: null,
      name: "",
      address: "",
      lat: "",
      lng: "",
      phone: "",
      email: "",
      director: "",
      directorEmail: "",
      zoneDirector: "",
      zoneEmail: "",
      directorPhone: "",
      zonePhone: "",
    });
  };
  const closeEditModal = () => setEditingHotel(null);
  const handleEditSave = async (formData) => {
    try {
      const backend = toBackendShape(formData);
      if (editingHotel?.id) {
        await hotelsAPI.update(editingHotel.id, backend);
      } else {
        await hotelsAPI.create(backend);
      }

      const raw = await hotelsAPI.getAll();
      setHoteles(raw.map(toClientShape));
      closeEditModal();
    } catch (err) {
      console.error("❌ Error guardando hotel:", err);
    }
  };

  /* ---------- RENDER ---------- */
  return (
    <>
      <Helmet>
        <title>Mapa de Hoteles – Admin</title>
      </Helmet>

      <div className="p-4 md:p-6">
        {/* ---- BARRA DE FILTROS ---- */}
        <div className="relative z-[9] flex flex-col gap-3 p-4 bg-white/10 backdrop-blur-xl border border-white/10 shadow-lg rounded-xl max-w-5xl mx-auto">
          <div className="flex flex-wrap gap-3 items-start">
            {/* Hotel */}
            <div className="relative w-full md:w-auto flex-1 min-w-[150px]">
              <Autocomplete
                placeholder="🏨 Hotel"
                value={filters.hotel}
                onChange={handleHotelChange}
                options={hotelOptions}
              />
            </div>

            {/* Director */}
            <div className="relative w-full md:w-auto flex-1 min-w-[150px]">
              <Autocomplete
                placeholder="👤 Director"
                value={filters.director}
                onChange={(val) => handleFilterChange("director", val)}
                options={directorOptions}
              />
            </div>

            {/* Zona */}
            <div className="relative w-full md:w-auto flex-1 min-w-[150px]">
              <Autocomplete
                placeholder="🗺️ Zona"
                value={filters.zonaDirector}
                onChange={(val) => handleFilterChange("zonaDirector", val)}
                options={zonaOptions}
              />
            </div>

            {/* Ciudad */}
            <div className="relative w-full md:w-auto flex-1 min-w-[150px]">
              <Autocomplete
                placeholder="📍 Ciudad"
                value={filters.ciudad}
                onChange={(val) => handleFilterChange("ciudad", val)}
                options={cityOptions}
              />
            </div>

            {/* Botones */}
            <button
              onClick={resetAll}
              className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium transition transform hover:scale-105"
            >
              Reset
            </button>
            <button
              onClick={handleNewHotel}
              className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium transition transform hover:scale-105"
            >
              Nuevo Hotel
            </button>
          </div>
        </div>

        {/* ---- MAPA ---- */}
        <div
          id="leafletMap"
          className="mt-4 z-[8] rounded-lg overflow-hidden shadow-md flex-1"
          style={{ height: "700px" }}
        />

        {/* ---- MODAL DE EDICIÓN / CREACIÓN ---- */}
        {editingHotel &&
          createPortal(
            <EditHotelModal
              hotel={editingHotel}
              onClose={closeEditModal}
              onSave={handleEditSave}
            />,
            document.body
          )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------
   MODAL DE EDICIÓN / CREACIÓN (responsive)
   ------------------------------------------------------------------ */
function EditHotelModal({ hotel, onClose, onSave }) {
  const [form, setForm] = useState({
    name: hotel.name ?? "",
    address: hotel.address ?? "",
    lat: hotel.lat ?? "",
    lng: hotel.lng ?? "",
    phone: hotel.phone ?? "",
    email: hotel.email ?? "",
    director: hotel.director ?? "",
    directorEmail: hotel.directorEmail ?? "",
    zoneDirector: hotel.zoneDirector ?? "",
    zoneEmail: hotel.zoneEmail ?? "",
    directorPhone: hotel.directorPhone ?? "",
    zonePhone: hotel.zonePhone ?? "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(form);
  };
  const title = hotel?.id ? "Editar Hotel" : "Nuevo Hotel";

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 backdrop-blur-sm z-[9999]">
      <div className="bg-white/90 backdrop-blur-lg rounded-xl shadow-xl w-full max-w-md sm:max-w-lg md:max-w-2xl mx-2 sm:mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">{title}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Dirección */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección
            </label>
            <input
              name="address"
              value={form.address}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Latitud */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Latitud
            </label>
            <input
              name="lat"
              value={form.lat}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Longitud */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longitud
            </label>
            <input
              name="lng"
              value={form.lng}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Director */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Director
            </label>
            <input
              name="director"
              value={form.director}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Teléfono Director */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono Director
            </label>
            <input
              name="directorPhone"
              value={form.directorPhone}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Email Director */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Director
            </label>
            <input
              name="directorEmail"
              value={form.directorEmail}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Director Zona */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Director Zona
            </label>
            <input
              name="zoneDirector"
              value={form.zoneDirector}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Teléfono Zona */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono Zona
            </label>
            <input
              name="zonePhone"
              value={form.zonePhone}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Email Zona */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Zona
            </label>
            <input
              name="zoneEmail"
              value={form.zoneEmail}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Botones */}
          <div className="col-span-2 flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white transition"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

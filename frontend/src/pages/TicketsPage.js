/*** src/pages/TicketsPage.jsx ***/
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  Fragment,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ticketsAPI,
  hotelsAPI,
  ticketTypesAPI,
  usersAPI,
  solutionTypesAPI,
} from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from "../components/ui/alert-dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Skeleton } from "../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Plus,
  Search,
  Filter as FilterIcon,
  X,
  Hand,
  ArrowDown,
  ArrowUp,
  Minus,
  Zap,
  RefreshCw,
  ArrowLeft,
  MoreHorizontal,
  Info,
  Bell,
  BellOff,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { Central_ID } from "../lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";

/* -------------------------------------------------
   WS – suscripción para mantener la tabla sincronizada
   ------------------------------------------------- */
import {
  getSocket,
  onMessage,
  sendMessage,
  connectSocket,
} from "../lib/ws";

/* -------------------------------------------------
   CACHE – wrapper sobre localStorage
   ------------------------------------------------- */
import { getCache, setCache, deleteCache } from "../lib/cache";

const CACHE_KEY = "tickets_table";
const CACHE_TTL = 5 * 60 * 1000; // 5 min

/* -------------------------------------------------
   Hook para detectar pantalla móvil (≤ 640 px)
   ------------------------------------------------- */
function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return mobile;
}

/* -------------------------------------------------
   COMPONENTES DE MODALES (definidos en‑line)
   ------------------------------------------------- */

/* ... TicketStatusAlert, CancelAlert, DeleteAlert quedan sin cambios ... */

function TicketStatusAlert({ ticket, onClose, technicians, solutionTypes }) {
  const [newStatus, setNewStatus] = useState(ticket.status);
  const [busy, setBusy] = useState(false);

  // Campos auxiliares que aparecen según el estado seleccionado
  const [assignedTech, setAssignedTech] = useState(
    ticket.assigned_to ? String(ticket.assigned_to) : ""
  );
  const [resolvedSolutionType, setResolvedSolutionType] = useState("");
  const [resolvedSolutionDesc, setResolvedSolutionDesc] = useState("");

  const statusOptions = [
    { value: "new", label: "Nuevo" },
    { value: "assigned", label: "Asignado" },
    { value: "in_progress", label: "En proceso" },
    { value: "waiting_response", label: "En espera" },
    { value: "resolved", label: "Resuelto" },
    { value: "closed", label: "Cerrado" },
  ];

  const handleSave = async () => {
    setBusy(true);
    try {
      // --- VALIDACIONES -------------------------------------------------
      if (newStatus === "assigned" && !assignedTech) {
        toast.error("Debe seleccionar un técnico para asignar");
        setBusy(false);
        return;
      }
      if (newStatus === "resolved") {
        if (!resolvedSolutionType) {
          toast.error("Debe seleccionar un tipo de solución");
          setBusy(false);
          return;
        }
        if (!resolvedSolutionDesc.trim()) {
          toast.error("Debe describir la solución");
          setBusy(false);
          return;
        }
      }

      // --- PREPARAR PAYLOAD ---------------------------------------------
      const payload = { status: newStatus };
      if (newStatus === "assigned") payload.assigned_to = assignedTech || null;
      if (newStatus === "resolved") {
        payload.solution_type_id = resolvedSolutionType;
        payload.solution = resolvedSolutionDesc;
      }

      await ticketsAPI.update(ticket.id, payload);
      toast.success("Estado actualizado");
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? "Error al cambiar estado");
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <AlertDialog open={true} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cambiar estado</AlertDialogTitle>
          <AlertDialogDescription>
            Selecciona el nuevo estado para el ticket&nbsp;
            <strong>{ticket.id}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* ESTADO */}
        <div className="my-4">
          <Select value={newStatus} onValueChange={setNewStatus}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona un estado" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* TÉCNICO (si asignado) */}
        {newStatus === "assigned" && (
          <div className="my-4">
            <Label htmlFor="tech-select">Técnico</Label>
            <Select value={assignedTech} onValueChange={setAssignedTech}>
              <SelectTrigger id="tech-select" className="w-full">
                <SelectValue placeholder="Selecciona un técnico" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={String(tech.id)}>
                    {tech.name ||
                      tech.full_name ||
                      `${tech.first_name ?? ""} ${tech.last_name ?? ""}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* SOLUCIÓN (si resuelto) */}
        {newStatus === "resolved" && (
          <>
            {/* Tipo de solución */}
            <div className="my-4">
              <Label htmlFor="solution-type-select">Tipo de solución</Label>
              <Select
                value={resolvedSolutionType}
                onValueChange={setResolvedSolutionType}
              >
                <SelectTrigger id="solution-type-select" className="w-full">
                  <SelectValue placeholder="Selecciona tipo de solución" />
                </SelectTrigger>
                <SelectContent>
                  {solutionTypes.map((st) => (
                    <SelectItem key={st.id} value={String(st.id)}>
                      {st.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Descripción */}
            <div className="my-4">
              <Label htmlFor="solution-desc">Descripción de la solución</Label>
              <Textarea
                id="solution-desc"
                placeholder="Describe brevemente cómo se resolvió el ticket"
                value={resolvedSolutionDesc}
                onChange={(e) => setResolvedSolutionDesc(e.target.value)}
                rows={4}
              />
            </div>
          </>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Diálogo de confirmación para cancelar (cerrar) un ticket.
 * El backend interpreta “cancelar” como pasar a estado `closed`.
 */
function CancelAlert({ ticket, onClose }) {
  const [busy, setBusy] = useState(false);

  const handleCancel = async () => {
    setBusy(true);
    try {
      await ticketsAPI.update(ticket.id, { status: "closed" });
      toast.success("Ticket cancelado");
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? "Error al cancelar el ticket");
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <AlertDialog open={true} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar ticket</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Seguro que deseas cancelar el ticket&nbsp;
            <strong>{ticket.title ?? ticket.id}</strong>?
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>No, volver</AlertDialogCancel>
          <AlertDialogAction onClick={handleCancel} disabled={busy}>
            {busy ? "Cancelando…" : "Sí, cancelar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteAlert({ ticket, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    try {
      await ticketsAPI.deleteTicket(ticket.id);
      toast.success("Ticket eliminado");
      if (onDeleted) onDeleted(ticket.id);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? "Error al eliminar el ticket");
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <AlertDialog open={true} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar ticket</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción es irreversible. ¿Seguro que deseas eliminar el ticket{" "}
            <strong>{ticket.id}</strong>?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={busy}>
            {busy ? "Eliminando…" : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* -------------------------------------------------
   COMPONENTE PRINCIPAL
   ------------------------------------------------- */
const TicketsPage = () => {
  /* ---------- ROUTER & AUTH ---------- */
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin, isTechnician } = useAuth();

  const isHotelUser = user?.role === "hotel_user";
  const isCentralUser = user?.role === "central_user";

  /* ---------- ESTADOS ---------- */
  const [tickets, setTickets] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [solutionTypes, setSolutionTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [takingTicket, setTakingTicket] = useState(null);
  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Modales globales
  const [statusModalTicket, setStatusModalTicket] = useState(null);
  const [cancelModalTicket, setCancelModalTicket] = useState(null);
  const [deleteModalTicket, setDeleteModalTicket] = useState(null);

  // Notificaciones (solo tipo "message")
  const { notifications, markAsRead } = useNotifications();

  /* ---------- REFS (para controlar “una sola vez”) ---------- */
  const wsInitialRequestedRef = useRef(false);
  const wsFullLoadedRef = useRef(false);

  /* ---------- HELPERS: normalizar GUID ---------- */
  const normalizeId = (id) => String(id).toLowerCase();

  /* ---------- MAPAS ID → NOMBRE ---------- */
  const hotelMap = useMemo(() => {
    const map = new Map();
    hotels.forEach((h) => {
      const key = normalizeId(h.id);
      if (h.id === Central_ID) map.set(key, "Central");
      else if (h.name) map.set(key, h.name);
      else if (h.nombre) map.set(key, h.nombre);
      else if (h.title) map.set(key, h.title);
    });
    return map;
  }, [hotels]);

  const technicianMap = useMemo(() => {
    const map = new Map();
    technicians.forEach((t) => {
      const key = normalizeId(t.id);
      if (t.name) map.set(key, t.name);
      else if (t.full_name) map.set(key, t.full_name);
      else if (t.first_name && t.last_name)
        map.set(key, `${t.first_name} ${t.last_name}`);
    });
    return map;
  }, [technicians]);

  const getHotelName = (hotelId) => {
    if (!hotelId) return "Desconocido";
    const name = hotelMap.get(normalizeId(hotelId));
    return name ?? "Desconocido";
  };

  const getTechnicianName = (techId) => {
    if (!techId) return "Sin asignar";
    const name = technicianMap.get(normalizeId(techId));
    return name ?? "Sin asignar";
  };

  /* ---------- ENRIQUECIMIENTO DE TICKET ---------- */
  const enrichTicket = (t) => ({
    ...t,
    hotel_name: getHotelName(t.hotel_id),
    technician_name: getTechnicianName(t.assigned_to),
  });

  /* ---------- NUEVO TICKET (formulario) ---------- */
  const [newTicket, setNewTicket] = useState({
    title: "",
    description: "",
    ticket_type_id: "",
    priority: "medium",
    hotel_id: isCentralUser ? Central_ID : "",
  });

  /* ---------- HOTELS DISPONIBLES PARA EL USUARIO ---------- */
  const availableHotels = useMemo(() => {
    if (isHotelUser) {
      const userHotelIds = new Set(
        (user?.hotel_ids ?? []).map((id) => String(id))
      );
      return hotels.filter((h) => userHotelIds.has(String(h.id)));
    }
    if (isCentralUser) return []; // no escoge hotel
    return hotels;
  }, [hotels, isHotelUser, isCentralUser, user?.hotel_ids]);

  /* --------------------------- RECONEXIÓN WS -------------------- */
  useEffect(() => {
    if (!getSocket()) {
      console.log("🔌 Intentando reconectar WebSocket...");
      connectSocket();
    }
  }, []);

  // Auto‑selección de hotel si solo hay uno disponible
  useEffect(() => {
    if (!isCentralUser && newTicket.hotel_id === "" && availableHotels.length === 1) {
      const only = availableHotels[0];
      setNewTicket((prev) => ({ ...prev, hotel_id: String(only.id) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableHotels, isCentralUser, newTicket.hotel_id]);

  /* -----------------------------------------------------------------
     LIMPIA FILTROS DE TÉCNICO FANTASMA
     ----------------------------------------------------------------- */
  useEffect(() => {
    if (isAdmin || isTechnician) {
      const params = new URLSearchParams(searchParams);
      if (params.has("technician")) {
        params.delete("technician");
        setSearchParams(params);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isTechnician]);

  /* -----------------------------------------------------------------
     METADATA – versión del servidor (para caché)
     ----------------------------------------------------------------- */
  const [cacheMeta, setCacheMeta] = useState(null); // { version: number }

  const checkVersionAgainstServer = async (localVersion) => {
    try {
      const { data } = await ticketsAPI.getMetadata(); // { version, lastModified }
      const serverVersion = data.version;

      if (localVersion !== serverVersion) {
        // versión cambió → recargamos todo vía WS (fallback HTTP)
        await fetchTicketsViaWs();
      } else {
        // misma versión → renovamos TTL
        const cached = getCache(CACHE_KEY);
        if (cached)
          setCache(CACHE_KEY, cached.data, {
            ttl: CACHE_TTL,
            version: serverVersion,
          });
      }
    } catch (err) {
      console.warn(
        "⚠️  Falló la obtención de metadata, se usará polling",
        err
      );
    }
  };

  /* -----------------------------------------------------------------
     CARGA DE DATOS AUXILIARES (hoteles, tipos, técnicos…)
     ----------------------------------------------------------------- */
  const loadAuxiliaryData = async () => {
    try {
      const [hotelsRes, typesRes, solutionTypesRes] = await Promise.all([
        hotelsAPI.getAll(),
        ticketTypesAPI.getAll(),
        solutionTypesAPI.getAll(),
      ]);

      setHotels(hotelsRes.data);
      setTicketTypes(typesRes.data);
      setSolutionTypes(solutionTypesRes?.data ?? []);

      if (isAdmin || isTechnician) {
        const usersRes = await usersAPI.getAll();
        setTechnicians(
          usersRes.data.filter(
            (u) => u.role === "technician" || u.role === "admin"
          )
        );
      }
    } catch (err) {
      console.error("❌  Error cargando datos auxiliares", err);
      toast.error("Error al cargar hoteles / tipos / técnicos");
    }
  };

  /* -----------------------------------------------------------------
     FETCH DE TICKETS VIA WS (solo al inicio)
     ----------------------------------------------------------------- */
  const fetchTicketsViaWs = async () => {
    if (!getSocket()) {
      // WS no disponible → fallback HTTP
      await fetchTicketsViaHttp();
      return;
    }

    // Evitamos enviar GET_TICKETS más de una vez por sesión
    if (wsInitialRequestedRef.current) return;
    wsInitialRequestedRef.current = true;

    const ok = sendMessage({
      type: "GET_TICKETS",
      payload: null,
      timestamp: new Date().toISOString(),
    });
    if (!ok) {
      // Si el envío falla, usamos HTTP como respaldo.
      await fetchTicketsViaHttp();
    }
    // La respuesta será procesada en el listener del WS
  };

  /* -----------------------------------------------------------------
     FETCH DE TICKETS POR HTTP (fallback)
     ----------------------------------------------------------------- */
  const fetchTicketsViaHttp = async () => {
    try {
      const ticketsRes = await ticketsAPI.getAll();
      const enriched = ticketsRes.data.map(enrichTicket);
      setTickets(enriched);
      const version = (await ticketsAPI.getMetadata()).data.version;
      setCacheMeta({ version });
      setCache(CACHE_KEY, enriched, {
        ttl: CACHE_TTL,
        version,
      });
    } catch (err) {
      console.error("❌  Error cargando tickets vía HTTP", err);
      toast.error("Error al cargar los tickets");
    } finally {
      setLoading(false);
    }
  };

  /* -----------------------------------------------------------------
     WS: suscripción a mensajes incrementales (solo una vez)
     ----------------------------------------------------------------- */
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    let cancelled = false;

    const handleWsMessage = async (msg) => {
      if (!msg?.type) return;

      // LISTA COMPLETA DE TICKETS
      if (msg.type === "TICKETS_FULL") {
        if (wsFullLoadedRef.current) return;
        const raw = msg.payload?.tickets ?? [];
        const enriched = raw.map(enrichTicket);
        if (!cancelled) {
          setTickets(enriched);
          setCacheMeta({ version: msg.payload?.version });
          setCache(CACHE_KEY, enriched, {
            ttl: CACHE_TTL,
            version: msg.payload?.version,
          });
          setLoading(false);
          wsFullLoadedRef.current = true;
        }
        return;
      }

      // TICKET ACTUALIZADO
      if (msg.type === "TICKET_UPDATED") {
        const { ticket } = msg.payload;
        const enriched = enrichTicket(ticket);
        if (!cancelled) {
          updateTicketInList(enriched.id, enriched);
          if (msg.payload.version) setCacheMeta({ version: msg.payload.version });
        }
        return;
      }

      // NOTIFICACIÓN DE MENSAJE (nuevo comentario externo)
      if (msg.type === "NOTIFICATION_CREATED") {
        const { ticket_id, user_id } = msg.payload;

        // Sólo nos interesa si la notificación es para el usuario actual
        if (String(user_id) === String(user?.id) && ticket_id) {
          setUnreadTicketSet((prev) => new Set(prev).add(String(ticket_id)));
        }
        return;
      }

      // TICKET ELIMINADO
      if (msg.type === "TICKET_DELETED") {
        const { id } = msg.payload;
        if (!cancelled) {
          setTickets((prev) => prev.filter((t) => t.id !== id));
          setCache(CACHE_KEY, tickets.filter((t) => t.id !== id), {
            ttl: CACHE_TTL,
            version: cacheMeta?.version,
          });
          // También lo sacamos del Set de no‑leídos
          setUnreadTicketSet((prev) => {
            const copy = new Set(prev);
            copy.delete(String(id));
            return copy;
          });
        }
        return;
      }

      // Otros mensajes -> fallback HTTP
      if (msg.type && typeof msg.type === "string" && msg.type.startsWith("TICKET_")) {
        if (!cancelled) await fetchTicketsViaHttp();
      }
    };

    const stop = onMessage(handleWsMessage);
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -----------------------------------------------------------------
     Polling fallback (5 s) – por si el WS desaparece
     ----------------------------------------------------------------- */
  useEffect(() => {
    const interval = setInterval(async () => {
      const cached = getCache(CACHE_KEY);
      if (!cached) {
        await fetchTicketsViaWs();
        return;
      }
      if (!cached.meta?.version) {
        await checkVersionAgainstServer(null);
      }
    }, 5_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -----------------------------------------------------------------
     TIMEOUT de seguridad: si después de X segundos sigue loading,
     hacemos fallback a HTTP.
     ----------------------------------------------------------------- */
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("⚠️  No se recibió TICKETS_FULL → fallback HTTP");
        fetchTicketsViaHttp();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [loading]);

  /* -----------------------------------------------------------------
     CARGA INICIAL + CACHE
     ----------------------------------------------------------------- */
  useEffect(() => {
    const init = async () => {
      //  CARGAMOS AUXILIARES (necesarios para los selects)
      await loadAuxiliaryData();

      // Intentamos leer tickets del caché (si existen)
      const cached = getCache(CACHE_KEY);
      if (cached?.data && cached?.meta?.version != null) {
        const enriched = (cached.data ?? []).map(enrichTicket);
        setTickets(enriched);
        setCacheMeta({ version: cached.meta.version });
        setLoading(false);
        await checkVersionAgainstServer(cached.meta.version);
        return;
      }

      // No hay caché → pedimos tickets al WS (solo la primera vez)
      await fetchTicketsViaWs();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -----------------------------------------------------------------
     HELPERS: actualizar una sola fila (para WS y UI)
     ----------------------------------------------------------------- */
  const updateTicketInList = (id, updates) => {
    setTickets((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const updated = { ...prev[idx], ...updates };
      const newArr = [...prev];
      newArr[idx] = updated;
      // refrescamos caché
      setCache(CACHE_KEY, newArr, {
        ttl: CACHE_TTL,
        version: cacheMeta?.version,
      });
      return newArr;
    });
  };

  /* ---------- SET DE TICKETS CON NOTIFICACIÓN NO LEÍDA ---------- */
  const [unreadTicketSet, setUnreadTicketSet] = useState(() => new Set());

  /* ---------- FUNCIÓN PARA SABER SI UN TICKET TIENE MENSAJE NUEVO ---------- */
  const hasNewMessage = (ticket) => {
    // Primero revisamos si el ticket está en el Set de "mensaje no leído"
    if (unreadTicketSet.has(String(ticket.id))) return true;

    // Si por alguna razón el Set está desactualizado, también podemos
    // revisar el contexto de notificaciones (solo por seguridad)
    return notifications.some(
      (n) =>
        n.type === "message" &&
        !n.is_read &&
        (n.ticket_id
          ? String(n.ticket_id) === String(ticket.id)
          : n.link?.includes(`/tickets/${ticket.id}`))
    );
  };

  /* ---------- MARCAR NOTIFICACIONES COMO LEÍDAS AL ABRIR EL TICKET ---------- */
  const handleTicketClick = (ticket) => {
    // Marcar todas las notificaciones del ticket como leídas
    const msgsToMark = notifications.filter(
      (n) =>
        n.type === "message" &&
        !n.is_read &&
        (n.ticket_id
          ? String(n.ticket_id) === String(ticket.id)
          : n.link?.includes(`/tickets/${ticket.id}`))
    );
    msgsToMark.forEach((n) => markAsRead(n.id));

    // Quitar del Set de no‑leídos
    setUnreadTicketSet((prev) => {
      const copy = new Set(prev);
      copy.delete(String(ticket.id));
      return copy;
    });

    // Navegamos al detalle del ticket
    navigate(`/tickets/${ticket.id}`);
  };

  /* -----------------------------------------------------------------
     FUNCIÓN PARA SABER SI UN TICKET ESTÁ CERRADO
     ----------------------------------------------------------------- */
  const isClosedTicket = (t) => t.status === "closed";

  /* ---------- CREAR TICKET (con adjuntos) ---------- */
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data: createdTicket } = await ticketsAPI.create(newTicket);
      const enriched = enrichTicket(createdTicket);

      if (selectedFiles.length) {
        await ticketsAPI.uploadAttachment(createdTicket.id, selectedFiles);
      }

      setTickets((prev) => [enriched, ...prev]);

      // Actualizamos caché
      const cached = getCache(CACHE_KEY);
      if (cached?.data) {
        setCache(CACHE_KEY, [enriched, ...cached.data], {
          ttl: CACHE_TTL,
          version: cacheMeta?.version,
        });
      }

      toast.success("Ticket creado correctamente");
      setDialogOpen(false);
      setNewTicket({
        title: "",
        description: "",
        ticket_type_id: "",
        priority: "medium",
        hotel_id: "",
      });
      setSelectedFiles([]);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear el ticket");
    } finally {
      setCreating(false);
    }
  };

  /* ---------- TOMAR TICKET (admin/tech) ---------- */
  const handleTakeTicket = async (ticketId, e) => {
    e.stopPropagation();
    setTakingTicket(ticketId);
    try {
      await ticketsAPI.take(ticketId);
      toast.success("Ticket tomado correctamente");

      const ok = sendMessage({
        type: "TICKET_TAKEN",
        payload: {
          id: ticketId,
          assigned_to: user?.id,
          status: "assigned",
          version: cacheMeta?.version,
        },
        timestamp: new Date().toISOString(),
      });
      if (!ok) await fetchTicketsViaWs(); // fallback
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al tomar el ticket");
    } finally {
      setTakingTicket(null);
    }
  };

  /* ---------- REABRIR, CANCELAR, ELIMINAR ---------- */
  const handleReopenTicket = async (ticketId) => {
    try {
      const reopenedTicket = await ticketsAPI.reopen(ticketId, { status: "new" });
      const enriched = enrichTicket(reopenedTicket);
      setTickets((prev) => [...prev, enriched]);
      toast.success("Ticket reabierto");
      updateTicketInList(ticketId, { status: "new" });
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? "Error al reabrir el ticket");
    }
  };

  const handleCancelTicket = async (ticketId) => {
    try {
      await ticketsAPI.update(ticketId, { status: "closed" });
      toast.success("Ticket cerrado");
      updateTicketInList(ticketId, { status: "closed" });

      setUnreadTicketSet((prev) => {
        const copy = new Set(prev);
        copy.delete(String(ticketId));
        return copy;
      });
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? "Error al cerrar el ticket");
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    try {
      await ticketsAPI.deleteTicket(ticketId);
      toast.success("Ticket eliminado");
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
      // También lo sacamos del Set de no‑leídos
      setUnreadTicketSet((prev) => {
        const copy = new Set(prev);
        copy.delete(String(ticketId));
        return copy;
      });
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? "Error al eliminar el ticket");
    }
  };

  /* ---------- FILTROS UI ---------- */
  const handleFilterChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== "all") newParams.set(key, value);
    else newParams.delete(key);
    setSearchParams(newParams);
    setCurrentPage(1); // reset paginación

    if (key === "priority") setPriorityFilter(value);
    if (key === "status") setStatusFilter(value);
    if (key === "hotel_id") setHotelFilter(value);
    if (key === "technician") setTechFilter(value);
    if (key === "tab") setActiveTab(value);
  };

  const clearFilters = () => {
    setSearchParams({});
    setPriorityFilter("");
    setStatusFilter("all");
    setHotelFilter("");
    setTechFilter("");
    setSearchQuery("");
    setActiveTab("all");
    setCurrentPage(1);
  };

  /* ---------- ESTADOS DE FILTRADO ---------- */
  const [priorityFilter, setPriorityFilter] = useState(
    searchParams.get("priority") || ""
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "all"
  );
  const [hotelFilter, setHotelFilter] = useState(
    searchParams.get("hotel_id") || ""
  );
  const [techFilter, setTechFilter] = useState(
    searchParams.get("technician") || ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "all"
  );

  /* ---------- FILTRADO DE TICKETS ---------- */
  const filteredTickets = tickets.filter((t) => {
    const lowerSearch = searchQuery.toLowerCase();

    const matchesSearch = !searchQuery
      ? true
      : t.title.toLowerCase().includes(lowerSearch) ||
        (t.description && t.description.toLowerCase().includes(lowerSearch));

    const matchesPriority = priorityFilter ? t.priority === priorityFilter : true;

    const matchesStatus =
      statusFilter && statusFilter !== "all"
        ? t.status === statusFilter
        : true;

    const matchesHotel = hotelFilter ? String(t.hotel_id) === String(hotelFilter) : true;

    const matchesTech = techFilter ? String(t.assigned_to) === String(techFilter) : true;

    return (
      matchesSearch &&
      matchesPriority &&
      matchesStatus &&
      matchesHotel &&
      matchesTech
    );
  });

  // ---------- PESTAS ----------
  const displayedTickets = (() => {
    if (activeTab === "deleted") {
      return filteredTickets.filter(isClosedTicket);
    }
    if (activeTab === "my") {
      if (isAdmin || isTechnician) {
        return filteredTickets.filter(
          (t) => t.assigned_to === user?.id || t.created_by === user?.id
        );
      }
      return filteredTickets.filter((t) => t.created_by === user?.id);
    }
    // all
    return filteredTickets.filter((t) => !isClosedTicket(t));
  })();

  const ticketsForPriorityCounts = useMemo(() => {
    const lowerSearch = searchQuery.toLowerCase();
    return tickets.filter((t) => {
      const matchesSearch = !searchQuery
        ? true
        : t.title.toLowerCase().includes(lowerSearch) ||
          (t.description && t.description.toLowerCase().includes(lowerSearch));
      const matchesHotel = hotelFilter ? t.hotel_id === hotelFilter : true;
      const matchesTech = techFilter ? t.assigned_to === techFilter : true;
      return matchesSearch && matchesHotel && matchesTech;
    });
  }, [tickets, searchQuery, hotelFilter, techFilter]);

  const priorityCounts = useMemo(() => {
    const map = {};
    ticketsForPriorityCounts.forEach((t) => {
      map[t.priority] = (map[t.priority] || 0) + 1;
    });
    return map;
  }, [ticketsForPriorityCounts]);

  const priorityTabs = [
    { value: "", label: "Todas", icon: FilterIcon },
    { value: "low", label: "Baja", icon: ArrowDown },
    { value: "medium", label: "Media", icon: Minus },
    { value: "high", label: "Alta", icon: ArrowUp },
    { value: "critical", label: "Crítica", icon: Zap },
  ];

  /* -------------------------------------------------
     HELPERS: fecha más reciente de un ticket
     ------------------------------------------------- */
  const getLatestTimestamp = (ticket) => {
    const updated = new Date(ticket.updated_at);
    const created = new Date(ticket.created_at);
    return updated > created ? updated : created;
  };

  /* -------------------------------------------------
     LISTA ORDENADA (más nuevo → más antiguo)
     ------------------------------------------------- */
  const sortedTickets = useMemo(() => {
    const copy = [...displayedTickets]; // displayedTickets = tickets filtrados por tab/filtros
    copy.sort((a, b) => {
      const aLatest = getLatestTimestamp(a);
      const bLatest = getLatestTimestamp(b);
      return bLatest - aLatest; // descendente
    });
    return copy;
  }, [displayedTickets]);

  /* ---------- PÁGINA ---------- */
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(displayedTickets.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const paginatedTickets = displayedTickets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handlePageSizeChange = (sizeStr) => {
    const size = Number(sizeStr);
    setPageSize(size);
    setCurrentPage(1);
  };

  /* ---------- HELPERS UI ---------- */
  const getPriorityBadge = (priority) => {
    const cfg = {
      critical: { label: "Crítica", className: "bg-red-500 text-white" },
      high: { label: "Alta", className: "bg-orange-500 text-white" },
      medium: { label: "Media", className: "bg-yellow-400 text-white" },
      low: { label: "Baja", className: "bg-green-200 text-zinc-700" },
    }[priority] || { label: priority, className: "bg-zinc-400 text-white" };
    return <Badge className={cfg.className}>{cfg.label}</Badge>;
  };

  const getStatusBadge = (status) => {
    const base =
      "inline-flex items-center justify-center min-w-[110px] px-3 py-1 text-xs font-semibold whitespace-nowrap";

    const cfg = {
      new: { label: "Nuevo", className: "bg-primary text-primary-foreground" },
      assigned: { label: "Asignado", className: "bg-indigo-600 text-white" },
      in_progress: {
        label: "En proceso",
        className: "bg-yellow-600 text-white",
      },
      waiting_response: {
        label: "En espera",
        className: "bg-gray-600 text-white",
      },
      resolved: { label: "Resuelto", className: "bg-green-600 text-white" },
      closed: { label: "Cerrado", className: "bg-red-600 text-white" },
    };

    const { label, className } =
      cfg[status] || {
        label: status,
        className: "bg-muted text-muted-foreground",
      };

    return <Badge className={`${base} ${className}`}>{label}</Badge>;
  };

  const canTakeTicket = (ticket) =>
    (isAdmin || isTechnician) &&
    (ticket.status === "new" || ticket.status === "assigned") &&
    (!ticket.assigned_to || ticket.assigned_to === null);

  /* ---------- Detección móvil ---------- */
  const isMobile = useIsMobile();

  /* ---------- RENDER ---------- */
  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative p-4">
      {/* ---------- HEADER + BOTÓN CREAR ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* BÚSQUEDA */}
        <div className="flex items-center gap-2 w-full sm:w-64">
          <ArrowLeft
            className="h-5 w-5 text-muted-foreground cursor-pointer"
            onClick={() => navigate("/")}
            data-testid="back-dashboard-btn"
          />
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="search-tickets"
            />
          </div>
        </div>

        {/* BOTÓN CREAR */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-ticket-btn">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Ticket
            </Button>
          </DialogTrigger>

          {/* DIÁLOGO DE CREAR */}
          <DialogContent className="sm:max-w-lg z-50">
            <form onSubmit={handleCreateTicket}>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Ticket</DialogTitle>
                <DialogDescription>
                  Complete los datos del incidente o solicitud
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* Título */}
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={newTicket.title}
                    onChange={(e) =>
                      setNewTicket({ ...newTicket, title: e.target.value })
                    }
                    placeholder="Describa brevemente el problema"
                    required
                    data-testid="ticket-title-input"
                  />
                </div>

                {/* Descripción */}
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={newTicket.description}
                    onChange={(e) =>
                      setNewTicket({
                        ...newTicket,
                        description: e.target.value,
                      })
                    }
                    placeholder="Proporcione más detalles"
                    rows={4}
                    required
                    data-testid="ticket-description-input"
                  />
                </div>

                {/* Tipo + Prioridad */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={newTicket.ticket_type_id}
                      onValueChange={(value) =>
                        setNewTicket({ ...newTicket, ticket_type_id: value })
                      }
                      required
                    >
                      <SelectTrigger data-testid="ticket-type-select">
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {ticketTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Prioridad</Label>
                    <Select
                      value={newTicket.priority}
                      onValueChange={(value) =>
                        setNewTicket({ ...newTicket, priority: value })
                      }
                    >
                      <SelectTrigger data-testid="ticket-priority-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baja</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="critical">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Hotel (except central_user) */}
                {!isCentralUser && (
                  <div className="space-y-2">
                    <Label>Hotel</Label>
                    <Select
                      value={newTicket.hotel_id}
                      onValueChange={(value) =>
                        setNewTicket({ ...newTicket, hotel_id: value })
                      }
                      required
                    >
                      <SelectTrigger data-testid="ticket-hotel-select">
                        <SelectValue placeholder="Seleccionar hotel" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableHotels.map((hotel) => (
                          <SelectItem
                            key={hotel.id}
                            value={String(hotel.id)}
                          >
                            {getHotelName(hotel.id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Adjuntos (opcional) */}
                <div className="space-y-2">
                  <Label>Adjuntar archivos (opcional)</Label>
                  <input
                    type="file"
                    accept={`
                      .html,.pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,
                      .mp4,.webm,.ogg,.mov,.avi
                    `}
                    multiple
                    ref={fileInputRef}
                    onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                    className="border rounded p-2 w-full"
                    data-testid="ticket-file-input"
                  />
                </div>
              </div>

              {/* Botones del diálogo */}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setSelectedFiles([]);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  data-testid="submit-ticket-btn"
                >
                  {creating ? "Creando…" : "Crear Ticket"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ---------- PRIORIDAD TABS ---------- */}
      <div className="flex flex-wrap gap-2 mb-2">
        {priorityTabs.map((tab) => (
          <Button
            key={tab.value}
            variant={priorityFilter === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange("priority", tab.value)}
            className={cn(
              "gap-2",
              priorityFilter === tab.value && "bg-primary text-primary-foreground"
            )}
            data-testid={`filter-priority-${tab.value || "all"}`}
          >
            {tab.icon && <tab.icon className="h-4 w-4" />}
            {tab.label}
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {tab.value ? priorityCounts[tab.value] ?? 0 : ticketsForPriorityCounts.length}
            </Badge>
          </Button>
        ))}
      </div>

      {/* ---------- HOTELES ASIGNADOS (solo hotel_user con >1) ---------- */}
      {isHotelUser && availableHotels.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {availableHotels.map((hotel) => (
            <Badge
              key={hotel.id}
              variant="secondary"
              className="text-sm"
              data-testid={`assigned-hotel-${hotel.id}`}
            >
              {getHotelName(hotel.id)}
            </Badge>
          ))}
        </div>
      )}

      {/* ---------- FILTROS (hotel, técnico, estado) ---------- */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FilterIcon className="h-4 w-4" />
              Filtros
            </CardTitle>
            {(hotelFilter || techFilter || statusFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-3 w-3" /> Limpiar
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* HOTEL */}
            {(isAdmin ||
              isTechnician ||
              (isHotelUser && availableHotels.length > 1)) &&
              !isCentralUser && (
                <Select
                  value={hotelFilter}
                  onValueChange={(v) => handleFilterChange("hotel_id", v)}
                >
                  <SelectTrigger className="w-48" data-testid="filter-hotel">
                    <SelectValue placeholder="Hotel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los hoteles</SelectItem>
                    {(isAdmin || isTechnician ? hotels : availableHotels).map(
                      (hotel) => (
                        <SelectItem
                          key={hotel.id}
                          value={String(hotel.id)}
                        >
                          {getHotelName(hotel.id)}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              )}

            {/* TÉCNICO */}
            {(isAdmin || isTechnician) && (
              <Select
                value={techFilter}
                onValueChange={(v) => handleFilterChange("technician", v)}
              >
                <SelectTrigger className="w-48" data-testid="filter-tech">
                  <SelectValue placeholder="Técnico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los técnicos</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem
                      key={tech.id}
                      value={String(tech.id)}
                    >
                      {getTechnicianName(tech.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* ESTADO */}
            <Select
              value={statusFilter}
              onValueChange={(v) => handleFilterChange("status", v)}
            >
              <SelectTrigger className="w-48" data-testid="filter-status">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="new">Nuevo</SelectItem>
                <SelectItem value="assigned">Asignado</SelectItem>
                <SelectItem value="in_progress">En proceso</SelectItem>
                <SelectItem value="waiting_response">En espera</SelectItem>
                <SelectItem value="resolved">Resuelto</SelectItem>
                <SelectItem value="closed">Cerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ---------- PESTAS (Todos / Mis tickets / Ver eliminados) ---------- */}
      <div className="flex gap-2 mb-2">
        <Button
          variant={activeTab === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => handleFilterChange("tab", "all")}
        >
          Todos
        </Button>
        <Button
          variant={activeTab === "my" ? "default" : "outline"}
          size="sm"
          onClick={() => handleFilterChange("tab", "my")}
        >
          Mis tickets
        </Button>
        {(isAdmin || isTechnician) && (
          <Button
            size="sm"
            variant={activeTab === "deleted" ? "default" : "outline"}
            onClick={() => handleFilterChange("tab", "deleted")}
          >
            {activeTab === "deleted" ? (
              <>
                <X className="mr-1 h-4 w-4" /> Ocultar eliminados
              </>
            ) : (
              <>
                <Eye className="mr-1 h-4 w-4" /> Ver eliminados
              </>
            )}
          </Button>
        )}
      </div>

      {/* ---------- TABLA (ESCRITORIO) ---------- */}
      {!isMobile ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* ID – oculto en móvil */}
                    <TableHead className="hidden sm:table-cell">ID</TableHead>

                    <TableHead>Título</TableHead>

                    {/* Hotel – oculto en móvil */}
                    <TableHead className="hidden sm:table-cell">Hotel</TableHead>

                    <TableHead>Prioridad</TableHead>

                    {(isAdmin || isTechnician) && (
                      <TableHead className="hidden md:table-cell">
                        Tomado
                      </TableHead>
                    )}

                    <TableHead>Estado</TableHead>

                    {/* Notificaciones – ocultas en móvil */}
                    <TableHead className="hidden sm:table-cell">
                      Notificaciones
                    </TableHead>

                    <TableHead>Fecha</TableHead>

                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedTickets.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={(isAdmin || isTechnician) ? 10 : 9}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {isHotelUser && availableHotels.length === 0
                          ? "No tienes hoteles asignados. Contacta al administrador."
                          : isHotelUser
                          ? `No hay tickets activos para tus ${availableHotels.length} hoteles${
                              activeTab === "deleted" ? " (incluidos eliminados)" : ""
                            }. Crea uno con “Nuevo Ticket”.`
                          : "No se encontraron tickets con los filtros actuales."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTickets.map((ticket) => {
                      const rowClickable = !isClosedTicket(ticket);
                      const hasNewMsg = hasNewMessage(ticket);
                      const canDeleteTicket = isAdmin;
                      const CancelMenu = !["closed"].includes(ticket.status);
                      const canCancelTicket =
                        (isAdmin || isTechnician || !ticket.assigned_to);
                      const canChangeState =
                        isAdmin ||
                        (isTechnician && ticket.assigned_to === user?.id);

                      return (
                        <TableRow
                          key={ticket.id}
                          className={cn(
                            rowClickable && "cursor-pointer",
                            "hover:bg-muted/20"
                          )}
                          onClick={() => handleTicketClick(ticket)}
                          data-testid={`ticket-row-${ticket.id}`}
                        >
                          {/* ID */}
                          <TableCell className="hidden sm:table-cell font-mono text-xs">
                            {ticket.id.slice(0, 8)}
                          </TableCell>

                          {/* Título */}
                          <TableCell className="font-medium max-w-xs truncate">
                            {ticket.title}
                          </TableCell>

                          {/* Hotel */}
                          <TableCell className="hidden sm:table-cell text-sm">
                            {ticket.hotel_name ?? getHotelName(ticket.hotel_id)}
                          </TableCell>

                          {/* Prioridad */}
                          <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>

                          {/* Tomado (solo admin/tech) */}
                          {(isAdmin || isTechnician) && (
                            <TableCell className="hidden md:table-cell">
                              {ticket.assigned_to ? (
                                ticket.assigned_to === user?.id ? (
                                  <Badge variant="secondary">Mío</Badge>
                                ) : (
                                  ticket.technician_name ??
                                  getTechnicianName(ticket.assigned_to)
                                )
                              ) : (
                                "Sin asignar"
                              )}
                            </TableCell>
                          )}

                          {/* Estado */}
                          <TableCell>{getStatusBadge(ticket.status)}</TableCell>

                          {/* Notificaciones */}
                          <TableCell className="hidden sm:table-cell">
                            {hasNewMsg ? (
                              <div className="flex items-center">
                                <Bell className="h-4 w-4 text-yellow-500 animate-pulse" />
                                <span className="sr-only">Nuevo mensaje</span>
                              </div>
                            ) : (
                              <BellOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>

                          {/* Fecha */}
                          <TableCell className="text-sm text-muted-foreground font-mono">
                            {new Date(ticket.created_at).toLocaleDateString(
                              "es-ES",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              }
                            )}
                          </TableCell>

                          {/* ACCIONES */}
                          <TableCell className="text-right">
                            {/* TOMAR */}
                            {canTakeTicket(ticket) && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={(e) => handleTakeTicket(ticket.id, e)}
                                disabled={takingTicket === ticket.id}
                                data-testid={`take-ticket-${ticket.id}`}
                              >
                                <Hand className="h-3 w-3 mr-1" />
                                {takingTicket === ticket.id ? "Tomando…" : "Tomar"}
                              </Button>
                            )}

                            {/* REABRIR */}
                            {["closed", "resolved"].includes(ticket.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="ml-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReopenTicket(ticket.id);
                                }}
                                data-testid={`reopen-ticket-${ticket.id}`}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Reabrir
                              </Button>
                            )}

                            {/* MENÚ DE TRES PUNTOS */}
                            {canCancelTicket && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="ml-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent
                                  align="end"
                                  className="w-48"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* Cambiar estado */}
                                  {canChangeState && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setStatusModalTicket(ticket);
                                      }}
                                    >
                                      Cambiar estado
                                    </DropdownMenuItem>
                                  )}

                                  {canChangeState && <DropdownMenuSeparator />}

                                  {/* Cancelar */}
                                  {CancelMenu && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCancelModalTicket(ticket);
                                      }}
                                    >
                                      Cancelar
                                    </DropdownMenuItem>
                                  )}

                                  {canDeleteTicket && <DropdownMenuSeparator />}

                                  {/* Eliminar */}
                                  {canDeleteTicket && (
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteModalTicket(ticket);
                                      }}
                                    >
                                      Eliminar
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          {/* ---------- PAGINACIÓN ---------- */}
          <CardContent className="flex items-center justify-between py-2 px-4">
            {/* Tamaño de página */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Filas por página:
              </span>
              <Select
                value={pageSize.toString()}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Navegación de página */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                ← Prev
              </Button>
              <span className="text-sm">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next →
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ---------- VISTA MOBILE: tarjetas ---------- */
        <div className="space-y-4">
          {paginatedTickets.map((ticket) => {
            const hasNewMsg = hasNewMessage(ticket);
            const rowClickable = !isClosedTicket(ticket);
            const canDeleteTicket = isAdmin;
            const CancelMenu = !["closed"].includes(ticket.status);
            const canCancelTicket = isAdmin || isTechnician || !ticket.assigned_to;
            const canChangeState =
              isAdmin ||
              (isTechnician && ticket.assigned_to === user?.id);
            const canTake = canTakeTicket(ticket);

            return (
              <Card
                key={ticket.id}
                className={cn(
                  "p-4 hover:bg-muted/20",
                  rowClickable && "cursor-pointer"
                )}
                onClick={() => handleTicketClick(ticket)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium">{ticket.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {ticket.hotel_name ?? getHotelName(ticket.hotel_id)}
                    </p>
                  </div>
                  {hasNewMsg && (
                    <Bell className="h-5 w-5 text-yellow-500 animate-pulse" />
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  {getPriorityBadge(ticket.priority)}
                  {getStatusBadge(ticket.status)}
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  {new Date(ticket.created_at).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </div>

                {/* ACCIONES (botones compactos) */}
                <div className="mt-3 flex flex-wrap gap-2 justify-end">
                  {canTake && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTakeTicket(ticket.id, e);
                      }}
                      disabled={takingTicket === ticket.id}
                      data-testid={`take-ticket-${ticket.id}`}
                    >
                      <Hand className="h-3 w-3 mr-1" />
                      {takingTicket === ticket.id ? "Tomando…" : "Tomar"}
                    </Button>
                  )}

                  {["closed", "resolved"].includes(ticket.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReopenTicket(ticket.id);
                      }}
                      data-testid={`reopen-ticket-${ticket.id}`}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reabrir
                    </Button>
                  )}

                  {(canCancelTicket || canDeleteTicket) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        align="end"
                        className="w-48"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canChangeState && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusModalTicket(ticket);
                            }}
                          >
                            Cambiar estado
                          </DropdownMenuItem>
                        )}

                        {canChangeState && <DropdownMenuSeparator />}

                        {CancelMenu && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancelModalTicket(ticket);
                            }}
                          >
                            Cancelar
                          </DropdownMenuItem>
                        )}

                        {canDeleteTicket && <DropdownMenuSeparator />}

                        {canDeleteTicket && (
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteModalTicket(ticket);
                            }}
                          >
                            Eliminar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </Card>
            );
          })}

          {/* ---------- PAGINACIÓN (mobile) ---------- */}
          <div className="flex items-center justify-between py-2">
            {/* Tamaño de página */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Filas por página:
              </span>
              <Select
                value={pageSize.toString()}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Navegación */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                ← Prev
              </Button>
              <span className="text-sm">
                {currentPage}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- MODALES ---------- */}
      {statusModalTicket && (
        <TicketStatusAlert
          ticket={statusModalTicket}
          onClose={() => setStatusModalTicket(null)}
          technicians={technicians}
          solutionTypes={solutionTypes}
        />
      )}
      {cancelModalTicket && (
        <CancelAlert
          ticket={cancelModalTicket}
          onClose={() => setCancelModalTicket(null)}
        />
      )}
      {deleteModalTicket && (
        <DeleteAlert
          ticket={deleteModalTicket}
          onClose={() => setDeleteModalTicket(null)}
          onDeleted={(deletedId) =>
            setTickets((prev) => prev.filter((t) => t.id !== deletedId)) }
        />
      )}
    </div>
  );
};

export default TicketsPage;

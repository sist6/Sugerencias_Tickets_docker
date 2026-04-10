// src/pages/TicketDetailPage.jsx
/*********************************************************************
 *  TicketDetailPage.jsx
 *
 *  - Muestra el detalle completo de un ticket.
 *  - Permite añadir un único comentario adicional cuando el ticket
 *    está **resuelto**.
 *  - Se corrigió la lógica que habilita/deshabilita el `<Textarea>`
 *    de comentario y se añadió la bandera `extraCommentAdded`.
 *  - Se simplificó la suscripción al WebSocket + polling.
 *  - **NUEVO**: botón “+ i” centrado que lleva al mapa del hotel
 *    (ruta `/admin/maphotels?hotel=Nombre+Hotel`).
 *  - **NUEVO**: icono `Info` al lado del nombre del hotel dentro de
 *    la tarjeta de “Detalles”. Al pulsarlo también abre el mapa.
 *  - **MEJORA**: en el modal de resolución el buscador y el
 *    desplegable están integrados en un solo componente
 *    (dropdown con input) para una mejor experiencia de usuario.
 *  - **NUEVO**: al marcar un ticket como Resuelto, la relación entre
 *    el tipo de solución seleccionado y el tipo de incidencia del ticket
 *    se persiste en la tabla `solution_types` (campo `incident_type_ids`).
 *********************************************************************/

import React, {
  useState,
  useEffect,
  useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ticketsAPI,
  hotelsAPI,
  ticketTypesAPI,
  usersAPI,
  solutionTypesAPI,
} from "../lib/api";
import {
  ArrowLeft,
  RefreshCw,
  Hand,
  Eye,
  Download,
  Paperclip,
  Trash2,
  Send,
  MessageSquare,
  User,
  Building,
  Tag,
  Clock,
  Check,
  Cpu,
  Phone,
  Plus,            // ← icono “+ i”
  Search,
  Info,            // ← icono Información (ver más)
} from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";      // ← nuevo import
import { Separator } from "../components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "../components/ui/alert-dialog";
import { Skeleton } from "../components/ui/skeleton";
import { toast } from "sonner";
import {
  getCache,
  setCache,
} from "../lib/cache";
import { getSocket, onMessage } from "../lib/ws";

const TicketDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isTechnician } = useAuth();

  /* ------------------------------------------------------------------
     ESTADOS
     ------------------------------------------------------------------ */
  const [ticket, setTicket] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [solutionTypes, setSolutionTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [comment, setComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showResolvePrompt, setShowResolvePrompt] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [taking, setTaking] = useState(false); // para “Tomar”
  const [allUsers, setAllUsers] = useState([]);

  const [resolveSolution, setResolveSolution] = useState("");
  const [resolveSolutionType, setResolveSolutionType] = useState(""); // id del tipo de solución

  // Bandera para evitar que se vuelva a habilitar el textarea después de
  // añadir el comentario extra permitido en un ticket Resuelto.
  const [extraCommentAdded, setExtraCommentAdded] = useState(false);

  // Estado de búsqueda dentro del modal de resolución
  const [solutionSearch, setSolutionSearch] = useState("");

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL
    ? process.env.REACT_APP_BACKEND_URL.replace(/\/+$/, "")
    : "http://192.168.125.52:15000";

  /* ------------------------------------------------------------------
     FETCH DE DATOS + WS + Polling
     ------------------------------------------------------------------ */
  useEffect(() => {
    const loadAll = async () => {
      await fetchData();
    };
    loadAll();

    // WebSocket -------------------------------------------------
    const socket = getSocket();
    let stopWS = null;
    if (socket) {
      stopWS = onMessage((msg) => {
        if (!msg?.type) return;
        if (typeof msg.type === "string" && msg.type.startsWith("TICKET_")) {
          fetchData(); // cualquier cambio en el ticket desencadena recarga
        }
      });
    }

    // Clave y TTL usados por la tabla de tickets (misma que en TicketsPage)
      const CACHE_KEY = "tickets_table";
      const CACHE_TTL = 5 * 60 * 1000;


    // Polling (fallback) ----------------------------------------
    const poll = setInterval(fetchData, 5_000); // cada 5 s
    return () => {
      clearInterval(poll);
      if (stopWS) stopWS();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Reset de la bandera cuando el ticket ya no está Resuelto
  useEffect(() => {
    if (ticket?.status !== "resolved") {
      setExtraCommentAdded(false);
    }
  }, [ticket?.id, ticket?.status]);

  const fetchData = async () => {
    try {
      const [
        ticketRes,
        hotelsRes,
        typesRes,
        solutionTypesRes,
      ] = await Promise.all([
        ticketsAPI.getById(id),
        hotelsAPI.getAll(),
        ticketTypesAPI.getAll(),
        solutionTypesAPI.getAll(),
      ]);

      setTicket(ticketRes.data);
      setHotels(hotelsRes.data);
      setTicketTypes(typesRes.data);
      setSolutionTypes(solutionTypesRes?.data ?? []);

      if (isAdmin || isTechnician) {
        const usersRes = await usersAPI.getAll();
        const usersData = usersRes?.data ?? [];
        setAllUsers(usersData);
        setTechnicians(
          usersRes.data.filter(
            (u) => u.role === "technician" || u.role === "admin"
          )
        );
      }

      await fetchAttachments(ticketRes.data.id);
    } catch (err) {
      toast.error("Error al cargar el ticket");
      navigate("/tickets");
    } finally {
      setLoading(false);
    }
  };

  const fetchAttachments = async (ticketId) => {
    try {
      const resp = await ticketsAPI.listAttachments(ticketId);
      setAttachments(resp.data ?? []);
    } catch (err) {
      toast.error("Error al cargar archivos adjuntos");
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await ticketsAPI.deleteAttachment(attachmentId);
      toast.success("Adjunto eliminado");
      if (ticket) await fetchAttachments(ticket.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar el adjunto");
    }
  };

  /* ------------------------------------------------------------------
     HELPERS – asegurar la relación SolutionType ↔ IncidentType
     ------------------------------------------------------------------ */
  /**
   * Los IDs son GUIDs (cadenas).  No los convertimos a número.
   *
   * @param {string} solutionId  GUID del registro en `solution_types`
   * @param {string} incidentId GUID del `ticket_type_id` del ticket
   */
  const ensureSolutionRelation = async (solutionId, incidentId) => {
    // Buscar el SolutionType en el estado usando la cadena completa
    const solution = solutionTypes.find((st) => st.id === solutionId);
    if (!solution) {
      toast.error("Tipo de solución no encontrado");
      return;
    }

    const current = Array.isArray(solution.incident_type_ids)
      ? solution.incident_type_ids
      : [];

    const incidentStr = String(incidentId);
    // Si ya está asociado, no hacemos nada
    if (current.includes(incidentStr)) return;

    const updated = [...current, incidentStr];

    try {
      await solutionTypesAPI.update(solutionId, {
        incident_type_ids: updated,
      });
    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
          "Error al guardar la relación en el tipo de solución"
      );
      // Propagar para que el llamador pueda decidir si continuar
      throw err;
    }
  };

  /* ------------------------------------------------------------------
     ACCIONES DE ESTADO
     ------------------------------------------------------------------ */
  const canChangeStatus =
    isAdmin || (isTechnician && ticket?.assigned_to === user?.id);

  const canReopen =
    (ticket?.status === "closed" || ticket?.status === "resolved") &&
    (isAdmin ||
      isTechnician ||
      user?.hotel_ids?.includes(ticket?.hotel_id));

  const canAssign =
    isAdmin || (isTechnician && ticket?.assigned_to === user?.id);

  const canDeleteTicket =
    isAdmin || (isTechnician && !ticket?.assigned_to);

  // Botón «Tomar» – solo si está sin asignar
  const canTakeTicket =
    (isAdmin || isTechnician) &&
    (ticket?.status === "new" || ticket?.status === "assigned") &&
    !ticket?.assigned_to;

  const handleTakeTicket = async () => {
    setTaking(true);
    try {
      await ticketsAPI.take(id);
      toast.success("Ticket tomado");
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al tomar el ticket");
    } finally {
      setTaking(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (newStatus === "closed") {
      setShowCloseConfirm(true);
      return;
    }
    if (newStatus === "resolved") {
      setShowResolvePrompt(true);
      return;
    }

    setUpdating(true);
    try {
      const resp = await ticketsAPI.update(id, { status: newStatus });
      setTicket(resp.data);
      toast.success("Estado actualizado");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al actualizar el estado");
    } finally {
      setUpdating(false);
    }
  };

  const confirmClose = async () => {
    setShowCloseConfirm(false);
    setUpdating(true);
    try {
      const resp = await ticketsAPI.update(id, { status: "closed" });
      setTicket(resp.data);
      toast.success("Ticket cerrado");
      navigate("/tickets");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al cerrar el ticket");
    } finally {
      setUpdating(false);
    }
  };

  /**
   * Guardar ticket como Resuelto y, además, crear/actualizar la relación
   * entre el SolutionType seleccionado y el IncidentType del ticket.
   */
  const confirmResolve = async () => {
    // -------------------------------------------------
    // 1️⃣  Validaciones preliminares
    // -------------------------------------------------
    if (!resolveSolutionType) {
      toast.error("Debe seleccionar un tipo de solución");
      return;
    }
    if (!resolveSolution.trim()) {
      toast.error("Debe escribir la solución");
      return;
    }

    setShowResolvePrompt(false);
    setUpdating(true);

    try {
      // -------------------------------------------------
      // 2️⃣  Guardar el ticket como Resuelto
      // -------------------------------------------------
      const resp = await ticketsAPI.update(id, {
        status: "resolved",
        solution: resolveSolution,
        solution_type_id: resolveSolutionType,
      });

      // -------------------------------------------------
      // 3️⃣  Aseguramos la relación Solution‑Type ↔ Incident‑Type
      // -------------------------------------------------
      const incidentId = ticket?.ticket_type_id; // GUID string
      if (incidentId) {
        await ensureSolutionRelation(resolveSolutionType, incidentId);
      }

      // -------------------------------------------------
      // 4️⃣  Recargar todos los datos (incluye solutionTypes actualizado)
      // -------------------------------------------------
      await fetchData();

      // -------------------------------------------------
      // 5️⃣  Estado local y feedback al usuario
      // -------------------------------------------------
      setTicket(resp.data);
      toast.success("Ticket marcado como Resuelto");
      setResolveSolution("");
      setResolveSolutionType("");
      setSolutionSearch("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al marcar como Resuelto");
    } finally {
      setUpdating(false);
    }
  };

  const handleAssign = async (techId) => {
    setUpdating(true);
    try {
      const assigneeToSend = techId === "_unassigned" ? null : techId;
      await ticketsAPI.assign(id, assigneeToSend);
      await fetchData();
      toast.success("Ticket asignado");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al asignar");
    } finally {
      setUpdating(false);
    }
  };

  const handleReopen = async () => {
    setUpdating(true);
    try {
      await ticketsAPI.reopen(id);
      await fetchData();
      toast.success("Ticket reabierto");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al reabrir");
    } finally {
      setUpdating(false);
    }
  };

  /* ------------------------------------------------------------------
     ELIMINAR TICKET (hard‑delete)
     ------------------------------------------------------------------ */
  const handleDeleteTicket = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await ticketsAPI.deleteTicket(ticket.id);
      toast.success("Ticket eliminado de forma permanente");
      const cached = getCache(CACHE_KEY);
      if (cached?.data) {
      const filtered = cached.data.filter((t) => t.id !== ticket.id);
      const version = cached.meta?.version; // mantenemos la versión si la hay
      setCache(CACHE_KEY, filtered, {
        ttl: CACHE_TTL,
        version,
      });
    }
      navigate("/tickets");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar el ticket");
    } finally {
      setDeleting(false);
    }
  };

  /* ------------------------------------------------------------------
     COMENTARIOS – LÓGICA DE PERMISOS (CORREGIDA)
     ------------------------------------------------------------------ */
  const canAddComment = useMemo(() => {
    if (!ticket) return false;

    // 1️⃣ Cerrado → nunca permite
    if (ticket.status === "closed") return false;

    // 2️⃣ Resuelto → permite **un** comentario extra
    if (ticket.status === "resolved") {
      if (!ticket.resolved_at) return false;
      const resolvedAt = new Date(ticket.resolved_at);
      const commentsAfter = (ticket.comments ?? []).filter(
        (c) => new Date(c.created_at) >= resolvedAt
      ).length;
      return commentsAfter < 1;
    }

    // 3️⃣ En cualquier otro estado → sin límite
    return true;
  }, [ticket?.status, ticket?.resolved_at, ticket?.comments]);

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    if (!canAddComment) {
      toast.error(
        "No se pueden añadir más comentarios a tickets resueltos o cerrados"
      );
      return;
    }
    setAddingComment(true);
    try {
      await ticketsAPI.addComment(id, { content: comment });
      setComment("");
      if (ticket?.status === "resolved") setExtraCommentAdded(true);
      await fetchData();
      toast.success("Comentario añadido");
    } catch (err) {
      toast.error("Error al añadir comentario");
    } finally {
      setAddingComment(false);
    }
  };

  /* ------------------------------------------------------------------
     HELPERS UI
     ------------------------------------------------------------------ */
  const getStatusBadge = (status) => {
    const cfg = {
      new: { label: "Nuevo", variant: "default" },
      assigned: { label: "Asignado", variant: "secondary" },
      in_progress: { label: "En proceso", variant: "secondary" },
      waiting_response: { label: "En espera", variant: "outline" },
      resolved: { label: "Resuelto", variant: "outline" },
      closed: { label: "Cerrado", variant: "outline" },
      cancelled: { label: "Cancelado", variant: "outline" },
    };
    const { label, variant } = cfg[status] || {
      label: status,
      variant: "outline",
    };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const cfg = {
      critical: { label: "Crítica", className: "bg-black text-white" },
      high: { label: "Alta", className: "bg-zinc-700 text-white" },
      medium: { label: "Media", className: "bg-zinc-400 text-white" },
      low: { label: "Baja", className: "bg-zinc-200 text-zinc-700" },
    }[priority] || { label: priority, className: "bg-zinc-400 text-white" };
    return <Badge className={cfg.className}>{cfg.label}</Badge>;
  };

  const getHotelName = (hotelId) => {
    if (!hotelId || hotelId === "central") return "Central";
    const h = hotels.find((hh) => hh.id === hotelId);
    return h?.name || "Desconocido";
  };

  const getTypeName = (typeId) => {
    const t = ticketTypes.find((tt) => tt.id === typeId);
    return t?.name || "Desconocido";
  };

  const getCreatedByName = () => {
    if (ticket?.created_by_name) return ticket.created_by_name;
    const userObj = technicians.find((u) => u.id === ticket?.created_by);
    return userObj?.name ?? ticket?.created_by ?? "Desconocido";
  };

  const getContacto = () => {
    const userObj = allUsers.find((u) => u.id === ticket?.created_by);
    if (!userObj) return "Desconocido";
    const phone = userObj.telf?.trim();
    const email = userObj.email?.trim();
    if (phone) return email ? `${phone} / ${email}` : phone;
    if (email) return email;
    return "Desconocido";
  };

  const getTechnicianName = (techId) => {
    const t = technicians.find((tt) => tt.id === techId);
    return t?.name || "Sin asignar";
  };

  const getSolutionTypeName = (typeId) => {
    const st = solutionTypes.find((s) => s.id === typeId);
    return st?.name || "Sin tipo de solución";
  };

  /* ------------------------------------------------------------------
     NUEVO HANDLER – abrir mapa centrado en el hotel del ticket
     ------------------------------------------------------------------ */
  const handleOpenMap = () => {
    if (!ticket?.hotel_id) {
      toast.error("Este ticket no tiene hotel asociado");
      return;
    }

    const hotel = hotels.find((h) => h.id === ticket.hotel_id);
    const hotelName = hotel?.name?.trim();

    if (!hotelName) {
      toast.error("No se encontró el hotel en los datos");
      return;
    }

    // Se utiliza URLSearchParams para que los espacios se codifiquen como '+'
    const query = new URLSearchParams({ hotel: hotelName }).toString();
    navigate(`/admin/maphotels?${query}`);
  };

  /* ------------------------------------------------------------------
     FILTRADO DE TIPOS DE SOLUCIÓN – usado en el modal de resolución
     ------------------------------------------------------------------ */
  const filteredSolutionTypes = useMemo(() => {
    const search = solutionSearch.trim().toLowerCase();

    // Si hay texto en el buscador → buscar entre TODOS los tipos
    if (search) {
      return solutionTypes.filter((st) =>
        (st.name ?? "").toLowerCase().includes(search)
      );
    }

    // Sin búsqueda → sólo los tipos vinculados al tipo de incidencia del ticket
    const ticketTypeId = ticket?.ticket_type_id;
    return solutionTypes.filter((st) =>
      (st.incident_type_ids ?? []).includes(ticketTypeId)
    );
  }, [solutionSearch, solutionTypes, ticket?.ticket_type_id]);

  /* ------------------------------------------------------------------
     RENDER
     ------------------------------------------------------------------ */
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ticket no encontrado</p>
        <Button variant="link" onClick={() => navigate("/tickets")}>
          Volver a tickets
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ---------- HEADER ---------- */}
      <div className="flex items-center gap-4">
        {/* Flecha «Atrás» */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          title="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Título y metadatos */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{ticket.title}</h1>
            {getStatusBadge(ticket.status)}
            {getPriorityBadge(ticket.priority)}
          </div>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            ID: {ticket.id}
          </p>
        </div>

        {/* Botón «Eliminar» (solo admin) */}
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeleteConfirm(true)}
            data-testid="delete-ticket-btn"
            aria-label="Eliminar ticket"
            title="Eliminar"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* ---------- LAYOUT ---------- */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ==== COL 1 (main content) ==== */}
        <div className="lg:col-span-2 space-y-6">
          {/* DESCRIPCIÓN */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descripción</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          {/* SOLUCIÓN */}
          {ticket.solution && (
            <Card className="border-green-500 bg-green-50 text-black">
              <CardHeader>
                <CardTitle className="text-base">Solución</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(ticket.solution_type_id && (isAdmin || isTechnician)) && (
                  <p className="text-sm font-medium">
                    Tipo: {getSolutionTypeName(ticket.solution_type_id)}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap">{ticket.solution}</p>
              </CardContent>
            </Card>
          )}

          {/* COMENTARIOS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comentarios ({ticket.comments?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Lista de comentarios */}
              {ticket.comments?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay comentarios
                </p>
              ) : (
                <div className="space-y-4">
                  {ticket.comments?.map((c) => (
                    <div key={c.id} className="border-l-2 border-border pl-4 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{c.user_name}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(c.created_at + "Z").toLocaleString("es-ES", {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                        </span>
                      </div>
                      <p className="text-sm">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* INPUT COMENTARIO */}
              <Textarea
                placeholder={
                  canAddComment && !extraCommentAdded
                    ? "Añadir comentario…"
                    : "No puedes comentar"
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                disabled={!canAddComment || addingComment || extraCommentAdded}
                data-testid="comment-input"
              />

              {/* Aviso cuando sí se permite un comentario extra tras RESOLVED */}
              {ticket?.status === "resolved" && canAddComment && !extraCommentAdded && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Puedes añadir <strong>un</strong> comentario adicional antes de
                  cerrar el ticket.
                </p>
              )}

              <Button
                onClick={handleAddComment}
                disabled={!canAddComment || !comment.trim() || addingComment}
                className="w-full"
                data-testid="add-comment-btn"
              >
                <Send className="mr-2 h-4 w-4" />
                {addingComment ? "Enviando…" : "Enviar comentario"}
              </Button>

              {/* Mensaje cuando los comentarios están bloqueados */}
              {(!canAddComment || extraCommentAdded) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {ticket?.status === "resolved" ? (
                    <>
                      Ya se ha añadido el comentario adicional permitido. No
                      puedes añadir más comentarios mientras el ticket está{" "}
                      <strong>resuelto</strong>. Reabre el ticket para volver a
                      comentar.
                    </>
                  ) : (
                    <>
                      No puedes añadir comentarios mientras el ticket está{" "}
                      <strong>cerrado</strong>. Reabre el ticket para volver a
                      comentar.
                    </>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ==== COL 2 (sidebar) ==== */}
        <div className="space-y-6">
          {/* DETALLES */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Hotel */}
              <div className="flex items-center gap-3">
                <Building className="h-4 w-4 text-muted-foreground" />

                <div className="flex flex-col">
                  <p className="text-xs text-muted-foreground">Hotel</p>

                  <div className="flex items-center">
                    <p className="text-sm font-medium">
                      {getHotelName(ticket.hotel_id)}
                    </p>

                    <Info
                      role="button"
                      title="Ver en mapa"
                      className="h-4 w-4 text-muted-foreground ml-2 cursor-pointer hover:text-foreground"
                      onClick={handleOpenMap}
                    />
                  </div>
                </div>
              </div>

              {/* Tipo de incidencia */}
              <div className="flex items-center gap-3">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="text-sm font-medium">{getTypeName(ticket.ticket_type_id)}</p>
                </div>
              </div>

              {/* Creado por */}
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Creado por</p>
                  <p className="text-sm font-medium">{getCreatedByName()}</p>
                </div>
              </div>

              {/* Contacto (solo admin/tech) */}
              {(isAdmin || isTechnician) && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Contacto</p>
                    <p className="text-sm font-medium">{getContacto()}</p>
                  </div>
                </div>
              )}

              {/* Asignado a */}
              <div className="flex items-center gap-3">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Asignado a</p>
                  <p className="text-sm font-medium">
                    {ticket.assigned_to
                      ? getTechnicianName(ticket.assigned_to)
                      : "Sin asignar"}
                  </p>
                </div>
              </div>

              {/* Creado */}
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Creado</p>
                  <p className="text-sm font-mono">
                    {new Date(ticket.created_at+"Z").toLocaleString("es-ES",{
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                  </p>
                </div>
              </div>

              {/* Resuelto */}
              {ticket.resolved_at && (
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Resuelto</p>
                    <p className="text-sm font-mono">
                      {new Date(ticket.resolved_at).toLocaleString("es-ES",{
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                    </p>
                  </div>
                </div>
              )}

              {/* Veces abierto (solo admin/tech) */}
              {(isAdmin || isTechnician) && (
                <div className="flex items-center gap-3">
                  <Hand className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Veces abierto</p>
                    <p className="text-sm font-medium">
                      {(ticket.reopened_count ?? 0) + 1}
                    </p>
                  </div>
                </div>
              )}

              {/* Adjuntos */}
              {attachments.length > 0 && (
                <div className="flex items-center gap-3">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Adjuntos</p>
                    <ul className="space-y-1">
                      {attachments.map((att) => (
                        <li key={att.id} className="flex items-center gap-2">
                          <span className="text-sm truncate flex-1">
                            {att.filename || att.file_name || att.name}
                          </span>
                          {att.url && (
                            <a
                              href={`${BACKEND_URL}${att.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                              data-testid={`download-attachment-${att.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          )}
                          {(isAdmin ||
                            ticket?.created_by === user?.id ||
                            ticket?.assigned_to === user?.id) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAttachment(att.id)}
                              data-testid={`delete-attachment-${att.id}`}
                              aria-label="Eliminar adjunto"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ACCIONES */}
          {(canChangeStatus ||
            canAssign ||
            canReopen ||
            canDeleteTicket ||
            canTakeTicket) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* BOTÓN TOMAR */}
                {canTakeTicket && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleTakeTicket}
                    disabled={taking}
                    className="w-full"
                    data-testid="take-ticket-detail-btn"
                  >
                    {taking ? "Tomando…" : "Tomar Ticket"}
                  </Button>
                )}

                {/* Cambiar estado */}
                {canChangeStatus && ticket.status !== "closed" && ticket.status !== "resolved" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Cambiar estado</p>
                    <Select
                      value={ticket.status}
                      onValueChange={handleStatusChange}
                      disabled={updating}
                    >
                      <SelectTrigger data-testid="status-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Nuevo</SelectItem>
                        <SelectItem value="assigned">Asignado</SelectItem>
                        <SelectItem value="in_progress">En proceso</SelectItem>
                        <SelectItem value="waiting_response">En espera</SelectItem>
                        <SelectItem value="resolved">Resuelto</SelectItem>
                        {isAdmin && (
                          <SelectItem
                            value="closed"
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                          >
                            Cerrado
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Cambiar prioridad */}
                {isAdmin && ticket.status !== "closed" && ticket.status !== "resolved" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Cambiar prioridad</p>
                    <Select
                      value={ticket.priority}
                      onValueChange={async (val) => {
                        setUpdating(true);
                        try {
                          const resp = await ticketsAPI.update(id, {
                            priority: val,
                          });
                          setTicket(resp.data);
                          toast.success("Prioridad actualizada");
                        } catch (err) {
                          toast.error(
                            err.response?.data?.detail ||
                              "Error al actualizar prioridad"
                          );
                        } finally {
                          setUpdating(false);
                        }
                      }}
                      disabled={updating}
                    >
                      <SelectTrigger data-testid="priority-select">
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
                )}

                {/* Asignar */}
                {canAssign && ticket.status !== "closed" && ticket.status !== "resolved" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Asignar a</p>
                    <Select
                      value={ticket.assigned_to ? String(ticket.assigned_to) : ""}
                      onValueChange={handleAssign}
                      disabled={updating}
                    >
                      <SelectTrigger data-testid="assign-select">
                        <SelectValue placeholder="Seleccionar técnico" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_unassigned">Sin asignar</SelectItem>
                        {technicians.map((tech) => (
                          <SelectItem key={tech.id} value={String(tech.id)}>
                            {tech.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Reabrir */}
                {canReopen && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full"
                        data-testid="reopen-btn"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reabrir Ticket
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Reabrir este ticket?</AlertDialogTitle>
                        <AlertDialogDescription>
                          El ticket volverá al estado “Nuevo” y será necesario
                          reasignarlo.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReopen}>Reabrir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {/* Eliminar (hard‑delete) */}
                {canDeleteTicket && (
                  <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                    <AlertDialogTrigger asChild />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este ticket?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción eliminará el ticket de forma permanente. No podrá
                          recuperarse.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTicket} disabled={deleting}>
                          {deleting ? "Eliminando…" : "Sí, eliminar"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
          )}

          {/* ---------- MODALES ---------- */}

          {/* CIERRE */}
          <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Confirmar cierre del ticket?</AlertDialogTitle>
                <AlertDialogDescription>
                  Una vez cerrado, el ticket ya no aparecerá en la vista “Todos”
                  y solo será visible mediante “Ver eliminados / cerrados”.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={confirmClose}>Cerrar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* RESOLUCIÓN – con SELECT de Tipo de Solución */}
          <AlertDialog open={showResolvePrompt} onOpenChange={setShowResolvePrompt}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Marcar como Resuelto</AlertDialogTitle>
                <AlertDialogDescription>
                  Seleccione un <strong>Tipo de Solución</strong> (obligatorio) y
                  describa brevemente cómo se resolvió el ticket.
                </AlertDialogDescription>
              </AlertDialogHeader>

              {/* ---------- SELECT (con buscador integrado) ---------- */}
              <div className="my-4">
                <Select
                  value={resolveSolutionType}
                  onValueChange={setResolveSolutionType}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccione un tipo de solución" />
                  </SelectTrigger>

                  <SelectContent>
                    {/* Input de búsqueda dentro del dropdown */}
                    <div className="px-2 py-1">
                      <Input
                        placeholder="Buscar por título..."
                        value={solutionSearch}
                        onChange={(e) => setSolutionSearch(e.target.value)}
                        className="w-full"
                      />
                    </div>

                    {/* Lista filtrada de tipos de solución */}
                    {filteredSolutionTypes.map((st) => (
                      <SelectItem key={st.id} value={String(st.id)}>
                        {st.name}
                      </SelectItem>
                    ))}

                    {/* Mensaje cuando no hay coincidencias */}
                    {filteredSolutionTypes.length === 0 && (
                      <SelectItem disabled value="_none">
                        No se encontraron tipos de solución
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* DESCRIPCIÓN DE LA SOLUCIÓN */}
              <Textarea
                placeholder="Descripción de la solución..."
                value={resolveSolution}
                onChange={(e) => setResolveSolution(e.target.value)}
                className="mb-4"
              />

              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setResolveSolution("");
                    setResolveSolutionType("");
                    setSolutionSearch("");
                    setShowResolvePrompt(false);
                  }}
                >
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction onClick={confirmResolve}>Guardar solución</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;

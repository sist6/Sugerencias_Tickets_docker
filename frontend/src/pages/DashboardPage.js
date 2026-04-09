// src/pages/DashboardPage.js
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  dashboardAPI,
  ticketsAPI,
  suggestionsAPI,
  ticketTypesAPI,
  hotelsAPI,
  projectsAPI,
  usersAPI,
} from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../components/ui/select';
import {
  Ticket,
  Lightbulb,
  LightbulbOff,
  FolderKanban,
  AlertCircle,
  ArrowRight,
  Hand,
  RefreshCw,
  Bell,
  BellOff,
  LockIcon,
  LockOpen,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../components/ui/tooltip';

import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Central_ID } from '../lib/utils';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isTechnician } = useAuth();

  /* ---------- ESTADOS ---------- */
  const [stats, setStats] = useState(null); // solo el gráfico de técnicos
  const [loading, setLoading] = useState(true);

  const [allTickets, setAllTickets] = useState([]);
  const [allSuggestions, setAllSuggestions] = useState([]);

  const [ticketTypes, setTicketTypes] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [projects, setProjects] = useState([]);
  const [visibleProjectIds, setVisibleProjectIds] = useState([]);
  const [myTakenTickets, setMyTakenTickets] = useState([]);

  // ----- MODALES RÁPIDOS -----
  const [quickTicketDialogOpen, setQuickTicketDialogOpen] = useState(false);
  const [quickTicketData, setQuickTicketData] = useState({
    title: '',
    description: '',
    ticket_type_id: '',
    priority: 'medium',
    hotel_id: '',
  });
  const [quickTicketFiles, setQuickTicketFiles] = useState([]);
  const quickTicketFileRef = useRef(null);
  const [quickTicketCreating, setQuickTicketCreating] = useState(false);
  const [technicians, setTechnicians] = useState([]);
  const [quickSuggestionDialogOpen, setQuickSuggestionDialogOpen] = useState(false);
  const [quickSuggestionData, setQuickSuggestionData] = useState({
    title: '',
    description: '',
    benefits: '',
  });
  const [quickSuggestionProjectId, setQuickSuggestionProjectId] = useState('');
  const [quickSuggestionFiles, setQuickSuggestionFiles] = useState([]);
  const quickSuggestionFileRef = useRef(null);
  const [quickSuggestionCreating, setQuickSuggestionCreating] = useState(false);

  /* -----------------------------------------------------------------
     METADATOS (tipos de ticket, hoteles, proyectos)
     ----------------------------------------------------------------- */
  useEffect(() => {
    if (!user) return;
    const fetchMeta = async () => {
      try {
        const [typesRes, hotelsRes, projectsRes] = await Promise.all([
          ticketTypesAPI.getAll(),
          hotelsAPI.getAll(),
          projectsAPI.getAll(),
        ]);
        setTicketTypes(typesRes.data);
        setHotels(hotelsRes.data);
        setProjects(projectsRes.data);

        const uid = user?.id ?? user?.sub;
        const visibleIds = projectsRes.data
          .filter((p) => {
            if (isAdmin || isTechnician) return true;
            if (p.user_ids?.includes(uid)) return true;
            if (
              user?.department_ids &&
              p.department_ids?.some((d) => user.department_ids.includes(d))
            )
              return true;
            return false;
          })
          .map((p) => p.id);
        setVisibleProjectIds(visibleIds);
      } catch (err) {
        console.error('Error loading meta data for dashboard:', err);
        toast.error('Error al cargar información adicional');
      }
    };
    fetchMeta();
  }, [user, isAdmin, isTechnician]);

  /* -----------------------------------------------------------------
     TICKETS, SUGERENCIAS y ESTADÍSTICAS (una única llamada)
     ----------------------------------------------------------------- */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, ticketsRes, suggestionsRes] = await Promise.all([
          dashboardAPI.getStats(),
          ticketsAPI.getAll(),
          suggestionsAPI.getAll(),
        ]);

        setStats({
          tickets_by_technician: statsRes.data.tickets_by_technician,
        });

        setAllTickets(ticketsRes.data);
        setAllSuggestions(suggestionsRes.data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        toast.error('Error al cargar datos del dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /* -----------------------------------------------------------------
     TICKETS TOMADOS POR EL USUARIO (NO RESUELTOS)
     ----------------------------------------------------------------- */
  useEffect(() => {
    if (!user) return;
    const fetchMyTickets = async () => {
      try {
        const { data } = await ticketsAPI.getAll();
        const my = data.filter(
          (t) =>
            t.assigned_to === user?.id &&
            t.status !== 'resolved' &&
            t.status !== 'closed'
        );
        setMyTakenTickets(my);
      } catch (err) {
        console.error('Error loading my taken tickets:', err);
      }
    };
    fetchMyTickets();
  }, [user]);

  /* -----------------------------------------------------------------
     TECNICO (admin/tech) – lista de técnicos
     ----------------------------------------------------------------- */
  useEffect(() => {
    if (!user) return;
    if (isAdmin || isTechnician) {
      const fetchTechs = async () => {
        try {
          const usersRes = await usersAPI.getAll();
          setTechnicians(
            usersRes.data.filter(
              (u) => u.role === 'technician' || u.role === 'admin'
            )
          );
        } catch (err) {
          console.error('Error cargando técnicos para Dashboard', err);
        }
      };
      fetchTechs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, isTechnician]);

  /* -----------------------------------------------------------------
     AUXILIARES DE ROL
     ----------------------------------------------------------------- */
  const isHotelUser = user?.role === 'hotel_user';
  const isCentralUser = user?.role === 'central_user';

  const availableHotels = useMemo(() => {
    if (isHotelUser) {
      return hotels.filter((h) => user?.hotel_ids?.includes(h.id));
    }
    if (isCentralUser) return []; // central_user no escoge hotel
    return hotels;
  }, [hotels, isHotelUser, isCentralUser, user?.hotel_ids]);

  // Auto‑selección de hotel cuando solo hay uno (hotel_user)
  useEffect(() => {
    if (
      !isCentralUser &&
      quickTicketData.hotel_id === '' &&
      availableHotels.length === 1
    ) {
      const onlyHotel = availableHotels[0];
      setQuickTicketData((prev) => ({
        ...prev,
        hotel_id: String(onlyHotel.id),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableHotels, isCentralUser, quickTicketData.hotel_id]);

  /* -----------------------------------------------------------------
     CONTADORES PARA LAS TARJETAS DE MÉTRICAS
     ----------------------------------------------------------------- */
  const ticketsOpenCount = useMemo(
    () =>
      allTickets.filter((t) =>
        ['new', 'assigned', 'in_progress', 'waiting_response'].includes(
          t.status
        )
      ).length,
    [allTickets]
  );

  const ticketsCriticalCount = useMemo(
    () =>
      allTickets.filter(
        (t) =>
          t.priority === 'critical' &&
          ['new', 'assigned', 'in_progress', 'waiting_response'].includes(
            t.status
          )
      ).length,
    [allTickets]
  );

  /* -----------------------------------------------------------------
     SUGERENCIAS VISIBLES
     ----------------------------------------------------------------- */
  const visibleSuggestions = useMemo(() => {
    if (isAdmin || isTechnician) return allSuggestions;

    return allSuggestions.filter((s) => {
      // 1️⃣ Sugerencia asociada a proyecto visible
      if (s.project_id) {
        return visibleProjectIds.includes(s.project_id);
      }

      // 2️⃣ Sugerencia “libre” → mismo centro
      const hotelId = s.hotel_id ?? null;

      if (isCentralUser) {
        return hotelId === Central_ID;
      }

      if (isHotelUser) {
        const userHotelIds = (user?.hotel_ids ?? []).map(String);
        return hotelId && userHotelIds.includes(String(hotelId));
      }

      // Otros usuarios (no admin/tech) no ven sugerencias libres
      return false;
    });
  }, [
    allSuggestions,
    isAdmin,
    isTechnician,
    visibleProjectIds,
    isCentralUser,
    isHotelUser,
    user?.hotel_ids,
  ]);

  const suggestionsNewCount = useMemo(
    () => visibleSuggestions.filter((s) => s.status === 'new').length,
    [visibleSuggestions]
  );

  const suggestionsInStudyCount = useMemo(
    () => visibleSuggestions.filter((s) => s.status === 'in_study').length,
    [visibleSuggestions]
  );

  const activeProjectsCount = useMemo(() => {
    const withStatus = projects.filter(
      (p) =>
        visibleProjectIds.includes(p.id) &&
        (p.status ? p.status === 'in_development' : true)
    );
    return withStatus.length;
  }, [projects, visibleProjectIds]);

  const totalVisibleProjects = useMemo(() => visibleProjectIds.length, [
    visibleProjectIds,
  ]);

  /* -----------------------------------------------------------------
     TARJETAS DE MÉTRICAS
     ----------------------------------------------------------------- */
  const metricCards = [
    {
      title: 'Tickets Abiertos',
      value: ticketsOpenCount,
      subtitle: (isAdmin || isTechnician) ? `${ticketsCriticalCount} críticos` : '',
      icon: Ticket,
      color:
        ticketsCriticalCount > 0 ? 'text-red-500' : 'text-foreground',
      bg:
        ticketsCriticalCount > 0
          ? 'bg-red-500/10 border border-red-500/40'
          : 'border',
      link: '/tickets',
    },
    {
      title: 'Propuestas Nuevas',
      value: suggestionsNewCount,
      subtitle: `${suggestionsInStudyCount} en estudio`,
      icon: Lightbulb,
      color: 'text-foreground',
      link: '/suggestions?status=new',
      show:
        isAdmin ||
        isTechnician ||
        user?.can_create_suggestions,
    },
    {
      title: 'Proyectos En Desarrollo',
      value: activeProjectsCount,
      subtitle: `${totalVisibleProjects} total`,
      icon: FolderKanban,
      color: 'text-foreground',
      link: '/projects',
      show:
        isAdmin ||
        isTechnician ||
        user?.can_create_suggestions,
    },
  ].filter((c) => c.show !== false);

  /* -----------------------------------------------------------------
     CREAR TICKET RÁPIDO
     ----------------------------------------------------------------- */
  const handleCreateQuickTicket = async (e) => {
    e.preventDefault();
    setQuickTicketCreating(true);
    try {
      const { data: createdTicket } = await ticketsAPI.create(quickTicketData);
      if (quickTicketFiles.length) {
        await ticketsAPI.uploadAttachment(createdTicket.id, quickTicketFiles);
      }
      toast.success('Ticket creado correctamente');
      setQuickTicketDialogOpen(false);
      setQuickTicketData({
        title: '',
        description: '',
        ticket_type_id: '',
        priority: 'medium',
        hotel_id: '',
      });
      setQuickTicketFiles([]);
      setAllTickets((prev) => [createdTicket, ...prev]);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear el ticket');
    } finally {
      setQuickTicketCreating(false);
    }
  };

  /* -----------------------------------------------------------------
     CREAR PROPUESTA RÁPIDA
     ----------------------------------------------------------------- */
  const selectableProjects = useMemo(
    () =>
      projects.filter(
        (p) => visibleProjectIds.includes(p.id) && !(p.has_files ?? false)
      ),
    [projects, visibleProjectIds]
  );

  const getTechnicianName = (techId) => {
    if (!techId) return 'Sin asignar';
    const t = technicians.find((tt) => tt.id === techId);
    return t?.name;
  };

  const handleCreateQuickSuggestion = async (e) => {
    e.preventDefault();
    setQuickSuggestionCreating(true);
    try {
      const payload = {
        ...quickSuggestionData,
        ...(quickSuggestionProjectId && {
          project_id: quickSuggestionProjectId,
        }),
      };
      const { data: createdSuggestion } = await suggestionsAPI.create(payload);
      if (quickSuggestionFiles.length) {
        for (const file of quickSuggestionFiles) {
          await suggestionsAPI.uploadAttachment(createdSuggestion.id, file);
        }
      }
      toast.success('Sugerencia creada correctamente');
      setQuickSuggestionDialogOpen(false);
      setQuickSuggestionData({ title: '', description: '', benefits: '' });
      setQuickSuggestionProjectId('');
      setQuickSuggestionFiles([]);
      setAllSuggestions((prev) => [createdSuggestion, ...prev]);
    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          'Error al crear la sugerencia'
      );
    } finally {
      setQuickSuggestionCreating(false);
    }
  };

  /* -----------------------------------------------------------------
     BADGES AUXILIARES – tickets
     ----------------------------------------------------------------- */
  const getTicketStatusBadge = (status) => {
    const cfg = {
      new: { label: 'Nuevo', className: 'bg-primary text-primary-foreground' },
      assigned: { label: 'Asignado', className: 'bg-indigo-600 text-white' },
      in_progress: {
        label: 'En proceso',
        className: 'bg-yellow-600 text-white',
      },
      waiting_response: {
        label: 'En espera',
        className: 'bg-gray-600 text-white',
      },
      resolved: { label: 'Resuelto', className: 'bg-green-600 text-white' },
      closed: { label: 'Cerrado', className: 'bg-red-600 text-white' },
      cancelled: {
        label: 'Cancelado',
        className: 'bg-muted text-muted-foreground',
      },
    };
    const { label, className } =
      cfg[status] ||
      { label: status, className: 'bg-muted text-muted-foreground' };
    return <Badge className={className}>{label}</Badge>;
  };

  // Badges de **sugerencias**
  const getSuggestionStatusBadge = (status) => {
    const cfg = {
      new: { label: 'Nueva', variant: 'default' },
      in_study: { label: 'En estudio', variant: 'secondary' },
      in_development: { label: 'En desarrollo', variant: 'default' },
      cancelled: { label: 'Cancelado', variant: 'destructive' },
      published: { label: 'Publicado', variant: 'outline' },
    };
    const { label, variant } = cfg[status] ?? {
      label: status,
      variant: 'outline',
    };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const cfg = {
      critical: { label: 'Crítica', className: 'bg-red-500 text-white' },
      high: { label: 'Alta', className: 'bg-orange-500 text-white' },
      medium: { label: 'Media', className: 'bg-yellow-400 text-white' },
      low: { label: 'Baja', className: 'bg-green-200 text-zinc-700' },
    }[priority] || { label: priority, className: 'bg-zinc-400 text-white' };
    return <Badge className={cfg.className}>{cfg.label}</Badge>;
  };

  const getPriorityIndicator = (priority) => {
    const colors = {
      critical: 'bg-red',
      high: 'bg-orange-500',
      medium: 'bg-yellow-400',
      low: 'bg-green-200',
    };
    return (
      <div
        className={`h-full w-1 rounded-full ${
          colors[priority] || colors.medium
        }`}
      />
    );
  };

  /* -----------------------------------------------------------------
     RECENT TICKETS (filtrados: sin estado CLOSED)
     ----------------------------------------------------------------- */
  const recentOpenTickets = useMemo(() => {
    // Mostramos tickets que **no estén cerrados** (ni resueltos)
    return allTickets
      .filter((t) => t.status !== 'closed' && t.status !== 'resolved')
      .slice(0, 5);
  }, [allTickets]);

  /* -----------------------------------------------------------------
     RENDER
     ----------------------------------------------------------------- */
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  /* Booleans de visibilidad para los contenedores que pueden quedar vacíos */
  const showSuggestionsCard =
    isAdmin || isTechnician || user?.can_create_suggestions;
  const showQuickSuggestion = !!user?.can_create_suggestions;

  return (
    <TooltipProvider>
    <div className="space-y-8 animate-fade-in">

      {/* ---- BIENVENIDA ---- */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Bienvenido, {user?.name?.split(' ')[0]}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Aquí tienes un resumen de la actividad del sistema
        </p>
      </div>

      {/* ---- TARJETAS DE MÉTRICAS ---- */}
      <div
        className={cn(
          'grid gap-4',
          'grid-cols-[repeat(auto-fit,_minmax(250px,_1fr))]'
        )}
      >
        {metricCards.map((metric) => (
          <Card
            key={metric.title}
            className="card-hover cursor-pointer"
            onClick={() => navigate(metric.link)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {metric.title}
            </CardTitle>
            {/* ----------------------------------------------
               Tooltip para el icono de “Tickets Abiertos”
               ------------------------------------------------- */}
            {metric.title === 'Tickets Abiertos' ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* el icono cambia de color según tickets críticos */}
                  <metric.icon
                    className={`h-4 w-4 ${metric.color}`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top">
                  {ticketsCriticalCount > 0
                    ? 'hay tickets críticos'
                   : 'no hay tickets críticos'}
                </TooltipContent>
              </Tooltip>
            ) : (
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            )}
          </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">
                {metric.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metric.subtitle}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ---- ACCIONES RÁPIDAS (MODALES) ---- */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Acciones Rápidas
          </CardTitle>
        </CardHeader>

        {/* Si solo hay una acción, ocupamos todo el ancho */}
        <CardContent
          className={cn(
            'grid gap-2',
            showQuickSuggestion ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
          )}
        >
          {/* TICKET RÁPIDO */}
          <Dialog
            open={quickTicketDialogOpen}
            onOpenChange={setQuickTicketDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="justify-start w-full" variant="outline">
                <Ticket className="mr-2 h-4 w-4" />
                Crear Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <form onSubmit={handleCreateQuickTicket}>
                <DialogHeader>
                  <DialogTitle>Crear Ticket Rápido</DialogTitle>
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
                      value={quickTicketData.title}
                      onChange={(e) =>
                        setQuickTicketData({
                          ...quickTicketData,
                          title: e.target.value,
                        })
                      }
                      placeholder="Describa brevemente el problema"
                      required
                    />
                  </div>

                  {/* Descripción */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      value={quickTicketData.description}
                      onChange={(e) =>
                        setQuickTicketData({
                          ...quickTicketData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Proporcione más detalles"
                      rows={4}
                      required
                    />
                  </div>

                  {/* Tipo + Prioridad */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select
                        value={quickTicketData.ticket_type_id}
                        onValueChange={(value) =>
                          setQuickTicketData({
                            ...quickTicketData,
                            ticket_type_id: value,
                          })
                        }
                        required
                      >
                        <SelectTrigger>
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
                        value={quickTicketData.priority}
                        onValueChange={(value) =>
                          setQuickTicketData({
                            ...quickTicketData,
                            priority: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Prioridad" />
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

                  {/* Hotel (solo si no es central_user) */}
                  {!isCentralUser && (
                    <div className="space-y-2">
                      <Label>Hotel</Label>
                      <Select
                        value={quickTicketData.hotel_id}
                        onValueChange={(value) =>
                          setQuickTicketData({
                            ...quickTicketData,
                            hotel_id: value,
                          })
                        }
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar hotel" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableHotels.map((hotel) => (
                            <SelectItem key={hotel.id} value={hotel.id}>
                              {hotel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Adjuntar archivos */}
                  <div className="space-y-2">
                    <Label>Adjuntar archivos (opcional)</Label>
                    <input
                      type="file"
                      multiple
                      ref={quickTicketFileRef}
                      onChange={(e) =>
                        setQuickTicketFiles(Array.from(e.target.files))
                      }
                      className="border rounded p-2 w-full"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setQuickTicketDialogOpen(false);
                      setQuickTicketFiles([]);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={quickTicketCreating}>
                    {quickTicketCreating ? 'Creando…' : 'Crear Ticket'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* SUGERENCIA RÁPIDA – sólo si tiene permiso */}
          {showQuickSuggestion && (
            <Dialog
              open={quickSuggestionDialogOpen}
              onOpenChange={setQuickSuggestionDialogOpen}
            >
              <DialogTrigger asChild>
                <Button className="justify-start w-full" variant="outline">
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Enviar Propuesta
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <form onSubmit={handleCreateQuickSuggestion}>
                  <DialogHeader>
                    <DialogTitle>Crear Propuesta Rápida</DialogTitle>
                    <DialogDescription>
                      Complete los datos de la propuesta
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    {/* Título */}
                    <div className="space-y-2">
                      <Label htmlFor="title">Título</Label>
                      <Input
                        id="title"
                        value={quickSuggestionData.title}
                        onChange={(e) =>
                          setQuickSuggestionData({
                            ...quickSuggestionData,
                            title: e.target.value,
                          })
                        }
                        placeholder="Nombre de la propuesta"
                        required
                      />
                    </div>

                    {/* Descripción */}
                    <div className="space-y-2">
                      <Label htmlFor="description">Descripción</Label>
                      <Textarea
                        id="description"
                        value={quickSuggestionData.description}
                        onChange={(e) =>
                          setQuickSuggestionData({
                            ...quickSuggestionData,
                            description: e.target.value,
                          })
                        }
                        placeholder="Describa la propuesta en detalle"
                        rows={4}
                        required
                      />
                    </div>

                    {/* Beneficios */}
                    <div className="space-y-2">
                      <Label htmlFor="benefits">Beneficios</Label>
                      <Textarea
                        id="benefits"
                        value={quickSuggestionData.benefits}
                        onChange={(e) =>
                          setQuickSuggestionData({
                            ...quickSuggestionData,
                            benefits: e.target.value,
                          })
                        }
                        placeholder="¿Qué beneficios aportará?"
                        rows={3}
                      />
                    </div>

                    {/* Proyecto (opcional) */}
                    <div className="space-y-2">
                      <Label>Proyecto (opcional)</Label>
                      <Select
                        value={quickSuggestionProjectId}
                        onValueChange={setQuickSuggestionProjectId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar proyecto…" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectableProjects.map((proj) => (
                            <SelectItem
                              key={proj.id}
                              value={String(proj.id)}
                            >
                              {proj.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {projects.length > 0 && selectableProjects.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No hay proyectos disponibles para vincular
                        </p>
                      )}
                    </div>

                    {/* Adjuntar archivos */}
                    <div className="space-y-2">
                      <Label>Adjuntar archivos (opcional)</Label>
                      <input
                        type="file"
                        multiple
                        ref={quickSuggestionFileRef}
                        onChange={(e) =>
                          setQuickSuggestionFiles(
                            Array.from(e.target.files)
                          )
                        }
                        className="border rounded p-2 w-full"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setQuickSuggestionDialogOpen(false);
                        setQuickSuggestionFiles([]);
                        setQuickSuggestionProjectId('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={quickSuggestionCreating}>
                      {quickSuggestionCreating ? 'Creando…' : 'Crear Propuesta'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      {/* ---- TICKETS TOMADOS POR MÍ (NO RESUELTOS) ---- */}
      {myTakenTickets.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Tickets Tomados (Pendientes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myTakenTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center gap-3 p-2 border rounded hover:bg-muted cursor-pointer"
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                >
                  {getPriorityIndicator(ticket.priority)}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        ticket.priority === 'critical' &&
                        ticket.status !== 'resolved'
                          ? 'text-red-500'
                          : ''
                      }`}
                    >
                      {ticket.title}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {new Date(ticket.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  {getPriorityBadge(ticket.priority)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- GRÁFICO Y LISTAS ---- */}
      <div
        className={cn(
          'grid gap-6',
          showSuggestionsCard ? 'lg:grid-cols-2' : 'lg:grid-cols-1'
        )}
      >
        {/* Tickets recientes (filtrados) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              Tickets Recientes
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/tickets')}
            >
              Ver todos
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentOpenTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay tickets recientes
              </p>
            ) : (
              <div className="space-y-3">
                {recentOpenTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center gap-3 p-3 rounded-sm border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                  >
                    {getPriorityIndicator(ticket.priority)}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          ticket.priority === 'critical' &&
                          ticket.status !== 'resolved'
                            ? 'text-red-500'
                            : ''
                        }`}
                      >
                        {ticket.title}
                      </p>

                      <p className="text-xs text-muted-foreground font-mono">
                        {new Date(ticket.created_at).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    {getPriorityBadge(ticket.priority)}
                    {getTicketStatusBadge(ticket.status)}
                    {(isAdmin || isTechnician) && (
                       <Badge variant="secondary">
                      {ticket.assigned_to ? (
                        <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <LockIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent side="top">Asignado</TooltipContent>
                        </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <LockOpen className="h-4 w-4 text-green-600 flex-shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent side="top">Disponible</TooltipContent>
                        </Tooltip>
                        </TooltipProvider>
                      )}
                    </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Propuestas recientes (solo si corresponde) */}
        {showSuggestionsCard && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Propuestas Recientes
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/suggestions')}
              >
                Ver todas
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {visibleSuggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay Propuestas recientes
                </p>
              ) : (
                <div className="space-y-3">
                {visibleSuggestions.slice(0, 5).map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="flex items-center gap-3 p-3 rounded-sm border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() =>
                      navigate(`/suggestions/${suggestion.id}`)
                    }
                  >
                    {suggestion.status !== 'new' ? (
                      <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Lightbulb
                            className="h-4 w-4 text-yellow-500 flex-shrink-0"
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top">En estudio</TooltipContent>
                     </Tooltip>
                    </TooltipProvider>
                    ) : (
                      <TooltipProvider>
                     <Tooltip>
                        <TooltipTrigger asChild>
                          <Lightbulb
                            className="h-4 w-4 text-muted-foreground flex-shrink-0"
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top">Nueva</TooltipContent>
                      </Tooltip>
                      </TooltipProvider>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {suggestion.title}
                      </p>
                     <p className="text-xs text-muted-foreground font-mono">
                        {new Date(suggestion.created_at).toLocaleDateString(
                          'es-ES'
                        )}
                      </p>
                    </div>
                    {getSuggestionStatusBadge(suggestion.status)}
                  </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ---- ALERTAS DE PRIORIDAD (admin/tech) ---- */}
      {(isAdmin || isTechnician) && stats?.tickets?.critical > 0 && (
        <Card className="border-l-4 border-l-black">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertCircle className="h-6 w-6" />
            <div className="flex-1">
              <p className="font-medium">Tickets Críticos Pendientes</p>
              <p className="text-sm text-muted-foreground">
                Hay {stats.tickets.critical} ticket(s) con prioridad crítica
                que requieren atención inmediata
              </p>
            </div>
            <Button onClick={() => navigate('/tickets?priority=critical')}>
              Ver tickets
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
    </TooltipProvider>
  );
};

export default DashboardPage;

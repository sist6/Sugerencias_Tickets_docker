// src/pages/TicketsReportPage.js
/*********************************************************************
 *  TicketsReportPage.jsx
 *
 *  Dashboard con KPIs, filtros y varios gráficos.
 *
 *  Cambios realizados:
 *    • Ancho dinámico de los cards de los gráficos según su tipo
 *      (barra vs pastel) → 50 % ancho cuando ambos son pastel,
 *      barra ocupa 8 columnas y pastel 4 cuando están mezclados,
 *      y 100 % ancho apilado cuando ambos son barras.
 *    • Los botones que cambiaban de vista se han reemplazado por
 *      toggles tipo “switch” con los iconos correspondientes
 *      (BarChart3 ↔︎ PieChartIcon) y con los mismos
 *      `data‑testid` que antes (`incident‑toggle`,
 *      `solution‑toggle`).
 *    • Se añade lógica para que, cuando ambos modales están abiertos,
 *      los diálogos mantengan la misma proporción de ancho que los
 *      cards de los gráficos.
 *    • Se mantiene toda la lógica de carga de datos,
 *      filtros, KPIs y modales (crear tipo de solución y resolver
 *      ticket).
 *********************************************************************/

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ticketsReportAPI,
  ticketsAPI,
  suggestionsAPI,
  solutionTypesAPI,
  hotelsAPI,
  usersAPI,
} from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../components/ui/select";
import {
  Calendar,
  CheckCircle,
  Clock,
  TrendingUp,
  Award,
  Wrench,
  RefreshCw,
  AlertCircle,
  Plus,
  ThumbUp,
  Filter,
  Building2,
  Users,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { toast, Toaster } from "sonner";
import { cn } from "../../lib/utils";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../../components/ui/popover";
import { Calendar as CalendarComponent } from "../../components/ui/calendar";

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#22c55e",
  "#e11d48",
  "#14b8a6",
  "#db2777",
];

/* ---------- TOOLTIP PERSONALIZADO ---------- */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-sm text-foreground border px-4 py-3 rounded-lg shadow-xl">
        <p className="font-semibold text-sm">{label}</p>
        {payload.map((entry, i) => (
          <p
            key={i}
            className="text-sm mt-1 font-medium"
            style={{ color: entry.color }}
          >
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TicketsReportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allTickets, setAllTickets] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [solutionTypes, setSolutionTypes] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [pendingTickets, setPendingTickets] = useState([]);
  const { isAdmin, isTechnician } = useAuth();

  /* ---------- FILTROS ---------- */
  const [selectedHotel, setSelectedHotel] = useState("all");
  const [selectedTechnician, setSelectedTechnician] = useState("all");
  const [dateFrom, setDateFrom] = useState(
    startOfMonth(subDays(new Date(), 365))
  );
  const [dateTo, setDateTo] = useState(endOfMonth(new Date()));

  /* ---------- MODAL DE CREACIÓN DE TIPO ---------- */
  const [showCreateSolutionModal, setShowCreateSolutionModal] =
    useState(false);
  const [newSolutionName, setNewSolutionName] = useState("");
  const [newSolutionDesc, setNewSolutionDesc] = useState("");
  const [creatingSolution, setCreatingSolution] = useState(false);

  /* ---------- MODAL DE RESOLUCIÓN ---------- */
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [solution, setSolution] = useState("");
  const [selectedSolutionType, setSelectedSolutionType] = useState("");
  const [resolving, setResolving] = useState(false);
  const [trendOption, setTrendOption] = useState("month");

  /* ---------- MODO DE LOS GRÁFICOS ---------- */
  // Tipo de incidencia: "bar" (columnas) o "pie" (pastel)
  const [incidentChartMode, setIncidentChartMode] = useState("bar");
  // Tipo de solución: "pie" (pastel) o "bar" (columnas)
  const [solutionChartMode, setSolutionChartMode] = useState("pie");

  const colSpanClass = {
    4: "col-span-12 sm:col-span-4",
    6: "col-span-12 sm:col-span-6",
    8: "col-span-12 sm:col-span-8",
    12: "col-span-12",
  };

  /* ---------- TICKETS FILTRADOS ---------- */
  const filteredTickets = useMemo(() => {
    return allTickets.filter((t) => {
      /* ① Hotel */
      if (selectedHotel !== "all" && t.hotel_id !== selectedHotel) return false;

      /* ② Técnico (solo para admin / tech) */
      if (isAdmin || isTechnician) {
        if (
          selectedTechnician !== "all" &&
          t.assigned_to !== selectedTechnician
        ) {
          return false;
        }
      }

      /* ③ Rango de fechas (usamos la fecha de resolución cuando exista,
          fallback a la fecha de creación) */
      const ticketDate = new Date(t.resolved_at ?? t.created_at);
      if (dateFrom && ticketDate < dateFrom) return false;
      if (dateTo && ticketDate > dateTo) return false;

      /* ④ Permisos (admin / tech pueden ver todo) */
      if (isAdmin || isTechnician) return true;
      return false;
    });
  }, [
    allTickets,
    selectedHotel,
    selectedTechnician,
    dateFrom,
    dateTo,
    isAdmin,
    isTechnician,
  ]);

  /* ---------- GRÁFICO DE TICKETS POR TÉCNICO (admin/tech) ---------- */
  const technicianChartData =
    stats?.tickets_by_technician?.map((tech) => ({
      name: tech.name?.split(" ")[0] || "Sin nombre",
      tickets: tech.count,
    })) || [];

  /* ---------- DATA PARA GRÁFICO DE TIPOS DE SOLUCIÓN ---------- */
  const solutionTypesChartData = useMemo(() => {
    const idToName = {};
    solutionTypes.forEach((st) => {
      idToName[st.id] = st.name;
    });

    const countMap = {};
    filteredTickets.forEach((t) => {
      const sid = t.solution_type_id ?? t.solution_type?.id;
      if (!sid) return;
      const name = idToName[sid] ?? "Sin tipo";
      countMap[name] = (countMap[name] ?? 0) + 1;
    });

    return solutionTypes.map((st) => ({
      ...st,
      name: st.name,
      value: countMap[st.name] ?? 0,
    }));
  }, [solutionTypes, filteredTickets]);

  /* ---------- DATA PARA GRÁFICO DE TIPOS DE INCIDENTE ---------- */
  const incidentTypesChartData = useMemo(() => {
    const countMap = {};

    filteredTickets.forEach((t) => {
      const name =
        t.ticket_type_name ||
        (t.ticket_type && t.ticket_type.name) ||
        t.incident_type?.name ||
        t.incident_type ||
        t.incident_type_name ||
        "Sin tipo";

      countMap[name] = (countMap[name] ?? 0) + 1;
    });

    return Object.entries(countMap).map(([name, value]) => ({
      name,
      value,
    }));
  }, [filteredTickets]);

  /* ---------- TENDENCIA (tickets RESUELTOS) ---------- */
  const trendData = useMemo(() => {
    const map = {};

    filteredTickets.forEach((t) => {
      const d = new Date(t.resolved_at ?? t.created_at);
      let sortKey, label;

      if (trendOption === "week") {
        const year = format(d, "yyyy");
        const week = format(d, "ww");
        const day = format(d, "EE", { locale: es });
        sortKey = `${year}-W${week}-${day}`;
        label = `${day} ${format(d, "dd")}`;
      } else if (trendOption === "month") {
        const monthStart = startOfMonth(d);
        const weekOfMonth = Math.floor((d.getDate() - 1) / 7) + 1;
        sortKey = `${format(monthStart, "yyyy-MM")}-W${weekOfMonth}`;
        label = `Semana ${weekOfMonth}`;
      } else if (trendOption === "year") {
        sortKey = format(d, "yyyy-MM");
        label = format(d, "MMM", { locale: es });
      } else {
        sortKey = format(d, "yyyy-MM-dd");
        label = sortKey;
      }

      if (!map[sortKey]) map[sortKey] = { label, tickets: 0 };
      map[sortKey].tickets += 1;
    });

    return Object.entries(map)
      .map(([key, value]) => ({ ...value, sortKey: key }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ sortKey, ...rest }) => rest);
  }, [filteredTickets, trendOption]);

  /* ---------- KPI – tickets resueltos (status) ---------- */
  const ticketsResolvedCount = useMemo(() => {
    return filteredTickets.filter((t) =>
      ["resolved", "closed"].includes(t.status)
    ).length;
  }, [filteredTickets]);

  /* ---------- FUNCIÓN QUE TRAE TODA LA INFO ---------- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = {
      hotel_id: selectedHotel !== "all" ? selectedHotel : undefined,
      assigned_to:
        selectedTechnician !== "all" ? selectedTechnician : undefined,
      date_from: dateFrom?.toISOString(),
      date_to: dateTo?.toISOString(),
    };

    try {
      const [
        statsRes,
        ticketsRes,
        suggestionsRes,
        solutionTypesRes,
        pendingRes,
        usersRes,
        hotelsRes,
      ] = await Promise.all([
        ticketsReportAPI.getStats(params),
        ticketsAPI.getAll(params),
        suggestionsAPI.getAll(),
        solutionTypesAPI.getAll(),
        ticketsAPI.getAll({ ...params, status: "in_progress" }),
        usersAPI.getAll(),
        hotelsAPI.getAll(),
      ]);

      setStats(statsRes?.data);
      setAllTickets(ticketsRes?.data ?? []);
      setPendingTickets(pendingRes?.data ?? []);
      setSolutionTypes(solutionTypesRes?.data ?? []);
      setTechnicians(
        usersRes?.data?.filter(
          (u) => u.role === "technician" || u.role === "admin"
        ) ?? []
      );
      setHotels(hotelsRes?.data ?? []);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar los datos del dashboard");
    } finally {
      setLoading(false);
    }
  }, [
    selectedHotel,
    selectedTechnician,
    dateFrom,
    dateTo,
  ]);

  /* ---------- CARGAR DATOS ---------- */
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---------- CREAR TIPO DE SOLUCIÓN ---------- */
  const handleCreateSolution = async () => {
    if (!newSolutionName.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    setCreatingSolution(true);
    try {
      await solutionTypesAPI.create({
        name: newSolutionName.trim(),
        description: newSolutionDesc.trim(),
      });
      toast.success("Tipo de solución creado correctamente");
      setShowCreateSolutionModal(false);
      setNewSolutionName("");
      setNewSolutionDesc("");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo crear el tipo de solución");
    } finally {
      setCreatingSolution(false);
    }
  };

  /* ---------- RESOLVER TICKET ---------- */
  const handleResolveTicket = async () => {
    if (!selectedSolutionType) {
      toast.error("Debe seleccionar un tipo de solución");
      return;
    }
    if (!solution.trim()) {
      toast.error("Debe ingresar la descripción de la solución");
      return;
    }

    setResolving(true);
    try {
      await ticketsAPI.update(selectedTicket.id, {
        status: "resolved",
        solution,
        solution_type_id: selectedSolutionType,
      });
      toast.success("Ticket resuelto correctamente");
      setShowResolveModal(false);
      setSelectedTicket(null);
      setSolution("");
      setSelectedSolutionType("");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Error al resolver ticket");
    } finally {
      setResolving(false);
    }
  };

  /* ---------- MODALES SUPERPOSICIÓN ---------- */
  const bothModalsOpen = showCreateSolutionModal && showResolveModal;

  /* ---------- CÁLCULO DINÁMICO DE ANCHOS (col‑span) DE LOS CARDS ---------- */
  const incidentColSpan = (() => {
    if (incidentChartMode === "pie" && solutionChartMode === "pie") return 6; // 50 % cada uno
    if (incidentChartMode === "bar" && solutionChartMode === "pie") return 8; // barra mayor
    if (incidentChartMode === "pie" && solutionChartMode === "bar") return 4; // barra mayor del otro lado
    // ambos barras → 100 % ancho (stacked)
    return 12;
  })();

  const solutionColSpan = (() => {
    if (incidentChartMode === "pie" && solutionChartMode === "pie") return 6;
    if (incidentChartMode === "bar" && solutionChartMode === "pie") return 4; // pastel menor
    if (incidentChartMode === "pie" && solutionChartMode === "bar") return 8; // barra mayor
    // ambos barras → 100 % ancho (stacked)
    return 12;
  })();

  /* ---------- HELPERS PARA ANCHOS DE MODALES ---------- */
  const getModalWidthClass = (type) => {
    // `type` = "create" (modal crear tipo) o "resolve" (modal resolver)
    if (!bothModalsOpen) return "sm:max-w-lg w-full";

    // Ambos en pastel → 50 % cada modal (solo a partir de `sm:`)
    if (incidentChartMode === "pie" && solutionChartMode === "pie") {
      return "w-full sm:w-1/2 max-w-none";
    }

    // Incidente barra + Solución pastel
    if (incidentChartMode === "bar" && solutionChartMode === "pie") {
      return type === "resolve"
        ? "w-full sm:w-2/3 max-w-none"
        : "w-full sm:w-1/3 max-w-none";
    }

    // Incidente pastel + Solución barra
    if (incidentChartMode === "pie" && solutionChartMode === "bar") {
      return type === "create"
        ? "w-full sm:w-2/3 max-w-none"
        : "w-full sm:w-1/3 max-w-none";
    }

    // Ambos en barra → ancho completo
    return "w-full max-w-none";
  };

  /* ---------- RENDER ---------- */
  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* ---------- KPIs superiores ---------- */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          data-testid="kpi-section"
        >
          <Card className="card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Este Mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.tickets_this_month ?? 0}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Tickets resueltos
              </p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Award className="w-5 h-5" />
                Esta Semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.tickets_this_week ?? 0}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Tickets resueltos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ---------- Filtros ---------- */}
        <Card className="card-hover">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date From */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Desde
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="date-from-picker"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateFrom
                        ? format(dateFrom, "dd MMM yyyy", { locale: es })
                        : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Hasta
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="date-to-picker"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateTo
                        ? format(dateTo, "dd MMM yyyy", { locale: es })
                        : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Hotel */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Hotel
                </Label>
                <Select value={selectedHotel} onValueChange={setSelectedHotel}>
                  <SelectTrigger data-testid="hotel-filter">
                    <Building2 className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Todos los hoteles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los hoteles</SelectItem>
                    {hotels.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Technician */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Técnico
                </Label>
                <Select
                  value={selectedTechnician}
                  onValueChange={setSelectedTechnician}
                >
                  <SelectTrigger data-testid="technician-filter">
                    <Users className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Todos los técnicos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los técnicos</SelectItem>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ---------- KPI “Total Resueltos” ---------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-section">
          <Card className="card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Total Resueltos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{ticketsResolvedCount ?? 0}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Tickets solucionados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ---------- GRÁFICOS ---------- */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
          {/* Bar/Pie chart – Incident Types */}
          <Card
            className={cn("card-hover", colSpanClass[incidentColSpan])}
            data-testid="incident-type-chart"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Distribución por Tipo de Incidencia
              </CardTitle>
              {/* Toggle tipo de gráfico (barra ↔︎ pastel) */}
              <div
                onClick={() =>
                  setIncidentChartMode((prev) => (prev === "bar" ? "pie" : "bar"))
                }
                className="relative w-14 h-7 flex items-center bg-muted dark:bg-zinc-700 rounded-full p-1 cursor-pointer transition-colors duration-300"
                data-testid="incident-toggle"
                aria-label="Toggle incident chart type"
              >
                <BarChart3 className="absolute left-1 h-4 w-4 text-blue-500" />
                <PieChartIcon className="absolute right-1 h-4 w-4 text-green-500" />
                <div
                  className={cn(
                    "w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300",
                    incidentChartMode === "bar" ? "translate-x-0" : "translate-x-7"
                  )}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  {incidentChartMode === "bar" ? (
                    <BarChart
                      data={incidentTypesChartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="value"
                        name="Incidencias"
                        fill={CHART_COLORS[0]}
                        radius={[4, 4, 0, 0]}
                      >
                        {incidentTypesChartData.map((_, i) => (
                          <Cell
                            key={`cell-${i}`}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <PieChart>
                      <Pie
                        data={incidentTypesChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ percent }) =>
                          percent > 0 ? `${(percent * 100).toFixed(0)}%` : ""
                        }
                        labelLine={false}
                      >
                        {incidentTypesChartData.map((entry, i) => (
                          <Cell
                            key={`cell-${i}`}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        layout="horizontal"
                        align="center"
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: 12 }}
                      />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bar/Pie chart – Solution Types */}
          <Card
            className={cn("card-hover", colSpanClass[solutionColSpan])}
            data-testid="solution-type-chart"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Tipos de Solución
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowCreateSolutionModal(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Tipo
                </Button>
                {/* Toggle tipo de gráfico (barra ↔︎ pastel) */}
                <div
                  onClick={() =>
                    setSolutionChartMode((prev) => (prev === "pie" ? "bar" : "pie"))
                  }
                  className="relative w-14 h-7 flex items-center bg-muted dark:bg-zinc-700 rounded-full p-1 cursor-pointer transition-colors duration-300"
                  data-testid="solution-toggle"
                  aria-label="Toggle solution chart type"
                >
                  <BarChart3 className="absolute left-1 h-4 w-4 text-blue-500" />
                  <PieChartIcon className="absolute right-1 h-4 w-4 text-green-500" />
                  <div
                    className={cn(
                      "w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300",
                      solutionChartMode === "bar" ? "translate-x-0" : "translate-x-7"
                    )}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  {solutionChartMode === "pie" ? (
                    <PieChart>
                      <Pie
                        data={solutionTypesChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ percent }) =>
                          percent > 0 ? `${(percent * 100).toFixed(0)}%` : ""
                        }
                        labelLine={false}
                      >
                        {solutionTypesChartData.map((entry, i) => (
                          <Cell
                            key={`cell-${i}`}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        layout="horizontal"
                        align="center"
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: 12 }}
                      />
                    </PieChart>
                  ) : (
                    <BarChart
                      data={solutionTypesChartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="value"
                        name="Soluciones"
                        fill={CHART_COLORS[0]}
                        radius={[4, 4, 0, 0]}
                      >
                        {solutionTypesChartData.map((_, i) => (
                          <Cell
                            key={`cell-${i}`}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Line chart – Trend (Resolved Tickets) */}
          <Card className="col-span-12 card-hover" data-testid="trend-chart">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Tendencia de Tickets Resueltos
              </CardTitle>
              <Select value={trendOption} onValueChange={setTrendOption}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                  <SelectItem value="year">Año</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="tickets"
                      name="Tickets"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{
                        fill: "hsl(var(--primary))",
                        strokeWidth: 2,
                        r: 4,
                      }}
                      activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---------- TICKETS POR TÉCNICO (solo admin/tech) ---------- */}
        {(isAdmin || isTechnician) && technicianChartData.length > 0 && (
          <Card className="card-hover">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Tickets por Técnico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={technicianChartData}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="tickets"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* ====================== MODALES ====================== */}

      {/* ---- Modal crear nuevo tipo de solución ---- */}
      <Dialog
        open={showCreateSolutionModal}
        onOpenChange={setShowCreateSolutionModal}
      >
        <DialogContent
          className={cn(
            getModalWidthClass("create"),
            bothModalsOpen && "mt-12"
          )}
        >
          <DialogHeader>
            <DialogTitle>Crear Tipo de Solución</DialogTitle>
            <DialogDescription>
              Introduce nombre y descripción.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">
                Nombre<span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Nombre del tipo"
                value={newSolutionName}
                onChange={(e) => setNewSolutionName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Pasos a Seguir</Label>
              <Textarea
                placeholder="Pasos a seguir para solucionar la incidencia"
                value={newSolutionDesc}
                onChange={(e) => setNewSolutionDesc(e.target.value)}
                className="mt-1 min-h-24"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateSolutionModal(false)}
            >
              Cancelar
            </Button>

            <Button onClick={handleCreateSolution} disabled={creatingSolution}>
              {creatingSolution ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Creando…
                </>
              ) : (
                "Crear"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Modal resolver ticket ---- */}
      <Dialog open={showResolveModal} onOpenChange={setShowResolveModal}>
        <DialogContent
          className={cn(
            getModalWidthClass("resolve"),
            bothModalsOpen && "mt-12"
          )}
        >
          <DialogHeader>
            <DialogTitle>Resolver Ticket</DialogTitle>
            <DialogDescription>{selectedTicket?.title}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">
                Tipo de Solución<span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedSolutionType}
                onValueChange={setSelectedSolutionType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccione un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {solutionTypes.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">
                Descripción de la Solución<span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Describa cómo se resolvió el ticket"
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                className="mt-1 min-h-24"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResolveModal(false)}
            >
              Cancelar
            </Button>

            <Button
              onClick={handleResolveTicket}
              disabled={resolving || !selectedSolutionType || !solution.trim()}
            >
              {resolving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Resolviendo…
                </>
              ) : (
                "Resolver Ticket"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

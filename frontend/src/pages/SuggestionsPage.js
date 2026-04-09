// src/pages/SuggestionsPage.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { suggestionsAPI, projectsAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Skeleton } from '../components/ui/skeleton';
import {
  ArrowLeft,
  Lightbulb,
  BookOpen,
  Code,
  XCircle,
  CheckCircle,
  Hand,
  Plus,
  Search,
  FolderKanban,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Central_ID } from '../lib/utils'; // para la lógica de visibilidad de proyectos

/**
 * -----------------------------------------------------------------
 *  PÁGINA DETALLE – placeholder (el detalle real está en otro archivo)
 * -----------------------------------------------------------------
 */
const SuggestionDetailPage = () => {
  /* (el resto del código sigue igual…) */
  return null;
};

/* --------------------------------------------------------------
   PÁGINA PRINCIPAL: SUGERENCIAS
   -------------------------------------------------------------- */
const SuggestionsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ---------- AUTH ---------- */
  const {
    user,
    isAdmin,
    isTechnician,
    canCreateSuggestions,
  } = useAuth();

  const isHotelUser = user?.role === 'hotel_user';
  const isCentralUser = user?.role === 'central_user';

  /* ---------- ESTADOS ---------- */
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [projects, setProjects] = useState([]);
  const [visibleProjectIds, setVisibleProjectIds] = useState([]); // IDs que el usuario puede ver
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [newSuggestion, setNewSuggestion] = useState({
    title: '',
    description: '',
    benefits: '',
  });

  /* ---------- CANCELAR ---------- */
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  /* --------------------------------------------------------------
     TABS DE ESTADO
     -------------------------------------------------------------- */
  const statusTabs = [
    { value: '', label: 'Todas', icon: Lightbulb },
    { value: 'new', label: 'Nuevas', icon: Lightbulb },
    { value: 'in_study', label: 'En estudio', icon: BookOpen },
    { value: 'in_development', label: 'En desarrollo', icon: Code },
    { value: 'cancelled', label: 'Canceladas', icon: XCircle },
    { value: 'published', label: 'Publicadas', icon: CheckCircle },
  ];

  const handleFilterChange = (value) => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (value) newParams.set('status', value);
    else newParams.delete('status');
    setSearchParams(newParams);
    setStatusFilter(value);
  };

  /* --------------------------------------------------------------
     BÚSQUEDA
     -------------------------------------------------------------- */
  const handleSearchChange = (e) => {
    const v = e.target.value;
    setSearchQuery(v);
    const newParams = new URLSearchParams(searchParams.toString());
    if (v) newParams.set('search', v);
    else newParams.delete('search');
    setSearchParams(newParams);
  };

  /* --------------------------------------------------------------
     CARGA INICIAL – SUGERENCIAS
     -------------------------------------------------------------- */
  useEffect(() => {
    fetchAllSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllSuggestions = async () => {
    try {
      const { data } = await suggestionsAPI.getAll(); // solo tabla suggestions
      setSuggestions(data);
    } catch (err) {
      toast.error('Error al cargar las sugerencias');
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------------------
     CARGAR PROYECTOS + CALCULAR visibilidad
     -------------------------------------------------------------- */
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data } = await projectsAPI.getAll();
        setProjects(data ?? []);
      } catch (err) {
        toast.error('Error al cargar los proyectos');
      }
    };
    fetchProjects();
  }, []);

  // Cálculo de IDs de proyectos que el usuario puede ver
  useEffect(() => {
    if (!user) {
      setVisibleProjectIds([]);
      return;
    }

    const uid = user?.id ?? user?.sub;
    const visibleIds = projects
      .filter((p) => {
        // ADMIN / TECHNICIAN → todo
        if (isAdmin || isTechnician) return true;

        // Usuario asignado explícitamente al proyecto
        if (p.user_ids?.includes(uid)) return true;

        // Pertenece a uno de sus departamentos
        if (
          user?.department_ids &&
          p.department_ids?.some((d) => user.department_ids.includes(d))
        )
          return true;

        // HOTEL_USER → mismo hotel del proyecto
        if (isHotelUser && user?.hotel_ids?.includes(p.hotel_id)) return true;

        // CENTRAL_USER → mismo “centro”
        if (isCentralUser && p.hotel_id === Central_ID) return true;

        return false;
      })
      .map((p) => p.id);

    setVisibleProjectIds(visibleIds);
  }, [
    projects,
    user,
    isAdmin,
    isTechnician,
    isHotelUser,
    isCentralUser,
  ]);

  /* --------------------------------------------------------------
     CREAR SUGERENCIA (con archivos)
     -------------------------------------------------------------- */
  const handleCreateSuggestion = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        ...newSuggestion,
        ...(selectedProjectId && { project_id: selectedProjectId }),
      };
      const { data: createdSuggestion } = await suggestionsAPI.create(payload);

      if (selectedFiles.length) {
        for (const file of selectedFiles) {
          await suggestionsAPI.uploadAttachment(createdSuggestion.id, file);
        }
      }

      toast.success('Sugerencia creada correctamente');

      // Reset UI
      setDialogOpen(false);
      setNewSuggestion({ title: '', description: '', benefits: '' });
      setSelectedFiles([]);
      setSelectedProjectId('');
      if (fileInputRef.current) fileInputRef.current.value = null;

      fetchAllSuggestions();
    } catch (err) {
      console.error('Error al crear la sugerencia →', err);
      toast.error(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          'Error al crear la sugerencia'
      );
    } finally {
      setCreating(false);
    }
  };

  /* --------------------------------------------------------------
     ACCIONES DE LA TABLA (tomar, aprobar, publicar, cancelar)
     -------------------------------------------------------------- */
  const handleTake = async (id, e) => {
    e?.stopPropagation();
    setUpdating(id);
    try {
      await suggestionsAPI.take(id);
      toast.success('Sugerencia tomada correctamente');
      fetchAllSuggestions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al tomar la sugerencia');
    } finally {
      setUpdating(null);
    }
  };

  const handleStatusChange = async (id, newStatus, e) => {
    e?.stopPropagation();
    setUpdating(id);
    try {
      await suggestionsAPI.update(id, { status: newStatus });
      toast.success('Estado actualizado');
      fetchAllSuggestions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cambiar el estado');
    } finally {
      setUpdating(null);
    }
  };

  const openCancelDialog = (id, e) => {
    e?.stopPropagation();
    setCancellingId(id);
    setCancelReason('');
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancelReason.trim()) return;
    setUpdating(cancellingId);
    try {
      await suggestionsAPI.update(cancellingId, {
        status: 'cancelled',
        cancellation_reason: cancelReason.trim(),
      });
      toast.success('Sugerencia cancelada');
      setCancelDialogOpen(false);
      fetchAllSuggestions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cancelar');
    } finally {
      setUpdating(null);
      setCancellingId(null);
      setCancelReason('');
    }
  };

  /* --------------------------------------------------------------
     HELPERS UI
     -------------------------------------------------------------- */
  const getStatusBadge = (status) => {
    const map = {
      new: { label: 'Nueva', variant: 'default' },
      in_study: { label: 'En estudio', variant: 'secondary' },
      in_development: { label: 'En desarrollo', variant: 'secondary' },
      cancelled: { label: 'Cancelada', variant: 'destructive' },
      published: { label: 'Publicada', variant: 'outline' },
    };
    const { label, variant } = map[status] || { label: status, variant: 'outline' };
    return <Badge variant={variant}>{label}</Badge>;
  };

  // Busca el nombre del proyecto dentro del array `projects`
  const getProjectName = (projectId) => {
    if (!projectId) return null;
    const p = projects.find((proj) => proj.id === projectId);
    return p?.name ?? 'Desconocido';
  };

  /* --------------------------------------------------------------
     FILTRADO + REGLAS DE VISIBILIDAD
     -------------------------------------------------------------- */
  const {
    displayedSuggestions,
    statusCounts,
    totalFilteredCount,
  } = useMemo(() => {
    const lowerSearch = searchQuery.toLowerCase();
    const uid = user?.id ?? user?.sub;

    // ---------- SUGERENCIAS QUE PASAN FILTRO ----------
    const displayed = suggestions.filter((s) => {
      const matchesSearch =
        !searchQuery ||
        s.title.toLowerCase().includes(lowerSearch) ||
        s.description.toLowerCase().includes(lowerSearch);

      const matchesStatus = statusFilter ? s.status === statusFilter : true;

      // ADMIN / TECHNICIAN ve todo
      if (isAdmin || isTechnician) {
        return matchesSearch && matchesStatus;
      }

      // Creada por mí
      const createdByMe = (s.created_by?.id ?? s.created_by) === uid;

      // Pertenece a proyecto visible
      const inVisibleProject = s.project_id && visibleProjectIds.includes(s.project_id);

      // Hotel/User solo ve sus propias sugerencias o las que pertenecen a proyectos visibles
      return matchesSearch && matchesStatus && (createdByMe || inVisibleProject);
    });

    // ---------- CONTADORES ----------
    const counts = {};
    let total = 0;
    suggestions.forEach((s) => {
      const matchesSearch =
        !searchQuery ||
        s.title.toLowerCase().includes(lowerSearch) ||
        s.description.toLowerCase().includes(lowerSearch);
      if (!matchesSearch) return;

      if (isAdmin || isTechnician) {
        // admin ve todo
      } else {
        const createdByMe = (s.created_by?.id ?? s.created_by) === uid;
        const inVisibleProject = s.project_id && visibleProjectIds.includes(s.project_id);
        if (!(createdByMe || inVisibleProject)) return;
      }

      total += 1;
      counts[s.status] = (counts[s.status] ?? 0) + 1;
    });

    return {
      displayedSuggestions: displayed,
      statusCounts: counts,
      totalFilteredCount: total,
    };
  }, [
    suggestions,
    searchQuery,
    statusFilter,
    isAdmin,
    isTechnician,
    visibleProjectIds,
    user,
  ]);

  // Proyectos sin archivos (para crear una nueva sugerencia)
  const selectableProjects = projects.filter(
    (project) => !project.has_files || project.has_files === false
  );

  /* --------------------------------------------------------------
     RENDER
     -------------------------------------------------------------- */
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ---------- HEADER ---------- */}
      <div className="flex items-center justify-between">
        {/* ---------------- LEFT PART (Back + Search) ---------------- */}
        <div className="flex items-center gap-2 max-w-md w-full">
          {/* Flecha atrás */}
          <Button
            variant="ghost"
            size="icon"
            className="mr-1"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Buscador */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar sugerencias..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9"
              data-testid="search-suggestions"
            />
          </div>
        </div>

        {/* ---------------- RIGHT PART (Nuevo) ---------------- */}
        {canCreateSuggestions && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {/* Diálogo de crear */}
            <DialogTrigger asChild>
              <Button data-testid="create-suggestion-btn" className="ml-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nueva Propuesta de Mejora
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
              <form onSubmit={handleCreateSuggestion}>
                <DialogHeader>
                  <DialogTitle>Nueva Propuesta de Mejora</DialogTitle>
                  <DialogDescription>
                    Proponga una mejora o nuevo proyecto para el sistema
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  {/* Título */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Título</Label>
                    <Input
                      id="title"
                      value={newSuggestion.title}
                      onChange={(e) =>
                        setNewSuggestion({
                          ...newSuggestion,
                          title: e.target.value,
                        })
                      }
                      placeholder="Nombre de la sugerencia"
                      required
                      data-testid="suggestion-title-input"
                    />
                  </div>

                  {/* Descripción */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      value={newSuggestion.description}
                      onChange={(e) =>
                        setNewSuggestion({
                          ...newSuggestion,
                          description: e.target.value,
                        })
                      }
                      placeholder="Describa la sugerencia en detalle"
                      rows={4}
                      required
                      data-testid="suggestion-description-input"
                    />
                  </div>

                  {/* Beneficios */}
                  <div className="space-y-2">
                    <Label htmlFor="benefits">Beneficios</Label>
                    <Textarea
                      id="benefits"
                      value={newSuggestion.benefits}
                      onChange={(e) =>
                        setNewSuggestion({
                          ...newSuggestion,
                          benefits: e.target.value,
                        })
                      }
                      placeholder="¿Qué beneficios aportará?"
                      rows={3}
                      data-testid="suggestion-benefits-input"
                    />
                  </div>

                  {/* Proyecto (opcional) – solo proyectos sin archivos */}
                  <div className="space-y-2">
                    <Label htmlFor="project">Proyecto (opcional)</Label>
                    <Select
                      value={selectedProjectId}
                      onValueChange={setSelectedProjectId}
                    >
                      <SelectTrigger
                        className="w-full"
                        data-testid="suggestion-project-select"
                      >
                        <SelectValue placeholder="Selecciona proyecto…" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableProjects.map((proj) => (
                          <SelectItem key={proj.id} value={proj.id}>
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
                    <Label>Adjuntar archivos</Label>
                    <input
                      type="file"
                      accept={`
                        .html,
                        .pdf,
                        .doc,
                        .docx,
                        .png,
                        .jpg,
                        .jpeg,
                        .gif,
                        .webp,
                        .mp4,
                        .webm,
                        .ogg,
                        .mov,
                        .avi
                      `}
                      multiple
                      ref={fileInputRef}
                      onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                      className="border rounded p-2 w-full"
                      data-testid="suggestion-file-input"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      setSelectedFiles([]);
                      setSelectedProjectId('');
                      if (fileInputRef.current) fileInputRef.current.value = null;
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={creating} data-testid="submit-suggestion-btn">
                    {creating ? 'Creando …' : 'Crear Sugerencia'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* ---------- STATUS TABS ---------- */}
      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <Button
            key={tab.value}
            variant={statusFilter === tab.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange(tab.value)}
            className={cn(
              'gap-2',
              statusFilter === tab.value && 'bg-primary text-primary-foreground'
            )}
            data-testid={`filter-${tab.value || 'all'}`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {tab.value ? statusCounts[tab.value] ?? 0 : totalFilteredCount}
            </Badge>
          </Button>
        ))}
      </div>

      {/* ---------- LISTADO ---------- */}
      {displayedSuggestions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Lightbulb className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No se encontraron sugerencias</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  {/* La columna de acciones siempre está visible (para “Tomar”) */}
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedSuggestions.map((suggestion) => (
                  <TableRow
                    key={suggestion.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/suggestions/${suggestion.id}`)}
                    data-testid={`suggestion-row-${suggestion.id}`}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{suggestion.title}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {suggestion.description}
                        </p>
                      </div>
                    </TableCell>

                    {/* ---- PROYECTO ---- */}
                    <TableCell>
                      {suggestion.project_id ? (
                        <div className="flex items-center gap-1">
                          <FolderKanban className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{getProjectName(suggestion.project_id)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Libre</span>
                      )}
                    </TableCell>

                    <TableCell>{getStatusBadge(suggestion.status)}</TableCell>

                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {new Date(suggestion.created_at).toLocaleDateString('es-ES')}
                    </TableCell>

                    {/* ---------- ACCIONES ----------
                         • “Tomar” → visible para TODOS
                         • “Aprobar”, “Cancelar”, “Publicar” → solo admin o técnico asignado */}
                    <TableCell className="text-right">
                      <div
                        className="flex justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* TOMAR – disponible para cualquier usuario */}
                        {suggestion.status === 'new' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => handleTake(suggestion.id, e)}
                            disabled={updating === suggestion.id}
                            data-testid={`take-suggestion-${suggestion.id}`}
                          >
                            <Hand className="h-3 w-3 mr-1" />
                            {updating === suggestion.id ? 'Tomando…' : 'Tomar'}
                          </Button>
                        )}

                        {/* APROBAR / CANCELAR – solo admin o tech asignado */}
                        {(isAdmin || (isTechnician && suggestion.assigned_to === user?.id)) &&
                          suggestion.status === 'in_study' && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={(e) =>
                                  handleStatusChange(suggestion.id, 'in_development', e)
                                }
                                disabled={updating === suggestion.id}
                              >
                                Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => openCancelDialog(suggestion.id, e)}
                                disabled={updating === suggestion.id}
                              >
                                Cancelar
                              </Button>
                            </>
                          )}

                        {/* PUBLICAR – solo admin o tech asignado */}
                        {(isAdmin || (isTechnician && suggestion.assigned_to === user?.id)) &&
                          suggestion.status === 'in_development' && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={(e) =>
                                handleStatusChange(suggestion.id, 'published', e)
                              }
                              disabled={updating === suggestion.id}
                            >
                              Publicar
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ---------- DIALOG DE CANCELAR ---------- */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar sugerencia</DialogTitle>
            <DialogDescription>
              Indique el motivo por el cual desea cancelar esta sugerencia.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="cancel-reason">Motivo (obligatorio)</Label>
            <Textarea
              id="cancel-reason"
              placeholder="Explique brevemente por qué se cancela"
              rows={4}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!cancelReason.trim() || updating === cancellingId}
              onClick={handleCancelConfirm}
            >
              {updating === cancellingId ? 'Cancelando…' : 'Confirmar cancelación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuggestionsPage;

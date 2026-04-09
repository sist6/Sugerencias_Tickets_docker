// src/pages/ProjectDetailPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  projectsAPI,
  departmentsAPI,
  suggestionsAPI,
  usersAPI, // <-- lista completa de usuarios
} from '../lib/api';
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
import { Separator } from '../components/ui/separator';
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
} from '../components/ui/dialog';
import { Skeleton } from '../components/ui/skeleton';
import {
  ArrowLeft,
  Clock,
  Code,
  Rocket,
  Archive,
  RefreshCw,
  Trash2,
  Lightbulb,
  Search,
  X, // <-- icono “X” para eliminar usuarios / departamentos
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Checkbox } from '../components/ui/checkbox';

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isTechnician } = useAuth();

  /* -------------------- Estados principales -------------------- */
  const [project, setProject] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    version: '',
  });

  /* -------------------- Estados usuarios (acceso) -------------------- */
  const [allUsers, setAllUsers] = useState([]); // lista completa del sistema
  const [assignedUserIds, setAssignedUserIds] = useState([]); // IDs asignados directamente (incluye admin/tech)
  const [userDialogOpen, setUserDialogOpen] = useState(false);

  const [selectedUserIds, setSelectedUserIds] = useState([]); // IDs marcados en el dialog (solo “normales”)
  const [selectedDeptIds, setSelectedDeptIds] = useState([]); // IDs de departamentos marcados en el dialog
  const [userSearch, setUserSearch] = useState('');
  const [updatingUsers, setUpdatingUsers] = useState(false); // reutilizado para ambas acciones

  /* -------------------- Sugerencias -------------------- */
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  const canManage = isAdmin || isTechnician;

  /* -----------------------------------------------------------------
     CARGA INICIAL DE DATOS
   ----------------------------------------------------------------- */
  useEffect(() => {
    fetchData();
    fetchProjectSuggestions();
  }, [id]);

  // Departamentos + usuarios (para selector y módulo de acceso)
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [deptRes, userRes] = await Promise.all([
          departmentsAPI.getAll(),
          usersAPI.getAll(),
        ]);
        setDepartments(deptRes.data);
        setAllUsers(userRes.data);
      } catch (err) {
        toast.error('Error al cargar departamentos/usuarios');
      }
    };
    fetchMeta();
  }, []);

  const fetchData = async () => {
    try {
      const [projectRes, deptRes] = await Promise.all([
        projectsAPI.getById(id),
        departmentsAPI.getAll(),
      ]);
      const proj = projectRes.data;

      setProject(proj);
      setDepartments(deptRes.data);
      // el backend devuelve `user_ids` (y `department_ids` si existen)
      setAssignedUserIds(proj.user_ids ?? []); // ← ID de usuarios asignados directamente
      setEditForm({
        name: proj.name,
        description: proj.description,
        version: proj.version,
      });
    } catch (err) {
      toast.error('Error al cargar el proyecto');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      const response = await suggestionsAPI.getByProjectId(id);
      setSuggestions(response.data || []);
    } catch (err) {
      if (err.response?.status === 404) {
        setSuggestions([]);
        toast.info('No se encontraron sugerencias para este proyecto');
      } else {
        toast.error(
          'Error al cargar las sugerencias del proyecto: ' +
            (err.response?.data?.detail || err.message)
        );
      }
    } finally {
      setSuggestionsLoading(false);
    }
  };

  /* -----------------------------------------------------------------
     ACCIONES SOBRE EL PROYECTO
   ----------------------------------------------------------------- */
  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      await projectsAPI.update(id, { status: newStatus });
      setProject({ ...project, status: newStatus });
      toast.success('Estado actualizado');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveEdit = async () => {
    setUpdating(true);
    try {
      await projectsAPI.update(id, editForm);
      setProject({ ...project, ...editForm });
      setEditing(false);
      toast.success('Proyecto actualizado');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      await projectsAPI.delete(id);
      toast.success('Proyecto eliminado');
      navigate('/projects');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar');
    }
  };

  /**
   * Elimina un usuario del proyecto (solo los asignados directamente).
   */
  const handleRemoveUserFromProject = async (uid) => {
    setUpdatingUsers(true);
    try {
      const newUserIds = assignedUserIds.filter((id) => id !== uid);
      await projectsAPI.update(id, { user_ids: newUserIds });
      setAssignedUserIds(newUserIds);
      toast.success('Usuario eliminado del proyecto');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar usuario');
    } finally {
      setUpdatingUsers(false);
    }
  };

  /* -----------------------------------------------------------------
     HELPERS UI (badges, etc.)
   ----------------------------------------------------------------- */
  const getStatusBadge = (status) => {
    const cfg = {
      in_development: { label: 'En desarrollo', variant: 'default', icon: Code },
      published: { label: 'Publicado', variant: 'secondary', icon: Rocket },
      update_available: {
        label: 'Actualización disponible',
        variant: 'outline',
        icon: RefreshCw,
      },
      archived: { label: 'Archivado', variant: 'outline', icon: Archive },
    };
    const { label, variant, icon } = cfg[status] || {
      label: status,
      variant: 'outline',
      icon: Code,
    };
    const Icon = icon;
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getSuggestionStatusBadge = (status) => {
    const cfg = {
      new: { label: 'Nueva', variant: 'default' },
      in_study: { label: 'En estudio', variant: 'secondary' },
      in_development: { label: 'En desarrollo', variant: 'secondary' },
      cancelled: { label: 'Cancelada', variant: 'destructive' },
      published: { label: 'Publicada', variant: 'outline' },
    };
    const { label, variant } = cfg[status] || { label: status, variant: 'outline' };
    return <Badge variant={variant}>{label}</Badge>;
  };

  /**
   * Calcula todos los usuarios que **pueden ver** el proyecto:
   *   • Los usuarios asignados explícitamente (assignedUserIds)
   *   • Los usuarios cuyo department_id pertenece a project.department_ids
   */
  const visibleUserIds = useMemo(() => {
    if (!project) return [];

    const direct = assignedUserIds ?? [];

    const deptIds = project.department_ids ?? [];
    const fromDepts = allUsers
      .filter((u) => deptIds.includes(u.department_id))
      .map((u) => u.id);

    // unión sin duplicados
    return Array.from(new Set([...direct, ...fromDepts]));
  }, [assignedUserIds, allUsers, project?.department_ids]);

  /* -----------------------------------------------------------------
     RENDER
   ----------------------------------------------------------------- */
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Proyecto no encontrado</p>
        <Button variant="link" onClick={() => navigate('/projects')}>
          Volver a proyectos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ------------------- Header ------------------- */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{project.name}</h1>
            {getStatusBadge(project.status)}
            <Badge variant="outline" className="font-mono">
              v{project.version}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            ID: {project.id}
          </p>
        </div>
      </div>

      {/* ------------------- Grid ------------------- */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ==================== Main column ==================== */}
        <div className="lg:col-span-2 space-y-6">
          {/* Información del proyecto (editable) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Información del Proyecto</CardTitle>
              {canManage && !editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Editar
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Versión</Label>
                    <Input
                      value={editForm.version}
                      onChange={(e) => setEditForm({ ...editForm, version: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEdit} disabled={updating}>
                      {updating ? 'Guardando…' : 'Guardar'}
                    </Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Descripción</p>
                    <p className="text-sm whitespace-pre-wrap">{project.description}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sugerencias asociadas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Sugerencias Asociadas ({suggestions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {suggestionsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : suggestions.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No hay sugerencias asociadas a este proyecto
                </p>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((s) => (
                    <div
                      key={s.id}
                      className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/suggestions/${s.id}`)}
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium text-sm">{s.title}</h3>
                        {getSuggestionStatusBadge(s.status)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {s.description}
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(s.created_at).toLocaleDateString('es-ES')}
                        </span>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/suggestions/${s.id}`);
                          }}
                        >
                          Ver detalles
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ==================== Sidebar ==================== */}
        <div className="space-y-6">
          {/* Detalles básicos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Creado</p>
                  <p className="text-sm font-mono">
                    {new Date(project.created_at).toLocaleString('es-ES')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Creado Por</p>
                  <p className="text-sm font-mono">
                    {project.created_by?.username ??
                      project.created_by?.email ??
                      project.created_by?.id ??
                      '—'}
                  </p>
                </div>
              </div>

              {project.published_at && (
                <div className="flex items-center gap-3">
                  <Rocket className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Publicado</p>
                    <p className="text-sm font-mono">
                      {new Date(project.published_at).toLocaleString('es-ES')}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ----------- Usuarios con acceso (visibles) ----------- */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-base">Usuarios con acceso</CardTitle>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setUserDialogOpen(true)}>
                  Gestionar
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {visibleUserIds.length === 0 ? (
                <p className="text-muted-foreground">Ningún usuario tiene acceso</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {visibleUserIds.map((uid) => {
                    const u = allUsers.find((x) => x.id === uid);
                    if (!u) return null;

                    const isDirectlyAssigned = assignedUserIds.includes(uid);
                    return (
                      <Badge
                        key={uid}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {/* Sólo los usuarios asignados directamente pueden eliminarse aquí */}
                        {canManage && isDirectlyAssigned && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveUserFromProject(uid);
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                        <span className="ml-1">{u.name}</span>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ----------- Dialog de gestión (usuarios + departamentos) ----------- */}
          <Dialog
            open={userDialogOpen}
            onOpenChange={(open) => {
              setUserDialogOpen(open);
              if (open) {
                /* ---- 1️⃣  Preparar datos de usuarios normales ---- */
                const normalIds = assignedUserIds.filter((uid) => {
                  const u = allUsers.find((x) => x.id === uid);
                  return u && u.role !== 'admin' && u.role !== 'technician';
                });
                setSelectedUserIds(normalIds);
                /* ---- 2️⃣  Preparar departamentos actuales ---- */
                const currentDepts = project?.department_ids ?? [];
                setSelectedDeptIds(currentDepts);
                setUserSearch('');
              }
            }}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Gestionar acceso al proyecto</DialogTitle>
                <DialogDescription>
                  Selecciona los usuarios y departamentos que podrán ver este proyecto.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* ---------- Buscador de usuarios ---------- */}
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    placeholder="Buscar usuarios..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9"
                    data-testid="user-search-input"
                  />
                </div>

                {/* ---------- Chips de usuarios seleccionados ---------- */}
                {selectedUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedUserIds.map((uid) => {
                      const u = allUsers.find((x) => x.id === uid);
                      if (!u) return null;
                      return (
                        <Badge
                          key={uid}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {u.name}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedUserIds((prev) => prev.filter((id) => id !== uid))
                            }
                            className="ml-1 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* ---------- Lista de usuarios disponibles (excluye admin/tech y ya seleccionados) ---------- */}
                <div className="border rounded-sm p-3 max-h-64 overflow-y-auto">
                  {allUsers
                    .filter((u) => {
                      // 1️⃣ excluir admin / technician
                      if (u.role === 'admin' || u.role === 'technician') return false;
                      // 2️⃣ excluir ya seleccionados
                      if (selectedUserIds.includes(u.id)) return false;
                      // 3️⃣ filtro de búsqueda
                      const term = `${u.name} ${u.email}`.toLowerCase();
                      return term.includes(userSearch.toLowerCase());
                    })
                    .map((u) => {
                      const uid = u.id;
                      return (
                        <div key={uid} className="flex items-center gap-2">
                          <Checkbox
                            id={`proj-user-select-${uid}`}
                            checked={false}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedUserIds((prev) => [...prev, uid]);
                            }}
                          />
                          <label htmlFor={`proj-user-select-${uid}`} className="text-sm">
                            {u.name} ({u.email})
                          </label>
                        </div>
                      );
                    })}
                </div>

                <Separator className="my-4" />

                {/* ---------- DEPARTAMENTOS ---------- */}
                <h4 className="text-sm font-medium mb-2">Departamentos</h4>

                {/* ---------- Chips de departamentos seleccionados ---------- */}
                {selectedDeptIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedDeptIds.map((did) => {
                      const d = departments.find((x) => x.id === did);
                      if (!d) return null;
                      return (
                        <Badge
                          key={did}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {d.name}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedDeptIds((prev) => prev.filter((id) => id !== did))
                            }
                            className="ml-1 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* ---------- Lista de departamentos disponibles ---------- */}
                <div className="border rounded-sm p-3 max-h-64 overflow-y-auto">
                  {departments
                    .filter((d) => !selectedDeptIds.includes(d.id))
                    .map((d) => (
                      <div key={d.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`proj-dept-select-${d.id}`}
                          checked={false}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedDeptIds((prev) => [...prev, d.id]);
                          }}
                        />
                        <label htmlFor={`proj-dept-select-${d.id}`} className="text-sm">
                          {d.name}
                        </label>
                      </div>
                    ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  disabled={updatingUsers}
                  onClick={async () => {
                    setUpdatingUsers(true);
                    try {
                      // Enviamos ambos arrays (pueden estar vacíos)
                      await projectsAPI.update(id, {
                        user_ids: selectedUserIds,
                        department_ids: selectedDeptIds,
                      });
                      toast.success('Acceso actualizado');
                      // Refrescamos datos del proyecto (asignaciones y departamentos)
                      await fetchData();
                      setUserDialogOpen(false);
                    } catch (err) {
                      toast.error(err.response?.data?.detail || 'Error al actualizar acceso');
                    } finally {
                      setUpdatingUsers(false);
                    }
                  }}
                >
                  {updatingUsers ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ----------- Acciones (cambio de estado, borrar) ----------- */}
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cambiar Estado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={project.status}
                  onValueChange={handleStatusChange}
                  disabled={updating}
                >
                  <SelectTrigger data-testid="status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_development">En desarrollo</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="update_available">Actualización disponible</SelectItem>
                    <SelectItem value="archived">Archivado</SelectItem>
                  </SelectContent>
                </Select>

                {isAdmin && (
                  <>
                    <Separator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full" data-testid="delete-btn">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar proyecto
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente el
                            proyecto.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;

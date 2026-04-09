// src/pages/ProjectsPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { projectsAPI, departmentsAPI, usersAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Plus,
  Search,
  FolderKanban,
  Code,
  Rocket,
  Archive,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Checkbox } from '../components/ui/checkbox';

const ProjectsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin, isTechnician } = useAuth();

  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get('status') || ''
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Nuevo proyecto
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    version: '1.0.0',
    user_ids: [],
    department_ids: [],
  });

  // Buscador de usuarios dentro del diálogo
  const [userSearch, setUserSearch] = useState('');

  const statusTabs = [
    { value: '', label: 'Todos', icon: FolderKanban },
    { value: 'in_development', label: 'En desarrollo', icon: Code },
    { value: 'published', label: 'Publicados', icon: Rocket },
    { value: 'update_available', label: 'Actualización', icon: RefreshCw },
    { value: 'archived', label: 'Archivados', icon: Archive },
  ];

  /* ---------------------- CARGA DE META (departamentos y usuarios) ---------------------- */
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const deptRes = await departmentsAPI.getAll();
        setDepartments(deptRes.data);

        // Sólo admin y technician cargan el listado completo de usuarios.
        // El resto solo necesita su propio registro para poder asignarse.
        if (isAdmin || isTechnician) {
          const usrRes = await usersAPI.getAll();
          setUsers(usrRes.data);
        } else if (user?.id ?? user?.sub) {
          try {
            const curRes = await usersAPI.getById(user.id || user.sub);
            setUsers([curRes.data]);
          } catch (_) {
            setUsers([]);
          }
        }
      } catch (err) {
        console.error('Error al cargar departamentos/usuarios:', err);
        if (isAdmin || isTechnician) toast.error('Error al cargar datos auxiliares');
      }
    };
    if (user) fetchMeta();
  }, [isAdmin, isTechnician, user]);

  /* ---------------------- CARGA DE PROYECTOS ---------------------- */
  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, user]);

  const fetchProjects = async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;

      const response = await projectsAPI.getAll(params);
      const uid = user?.id ?? user?.sub;

      // Normalizamos los IDs del usuario a strings para comparaciones seguras
      const userIdStr = String(uid);
      const userHotelIds = new Set((user?.hotel_ids ?? []).map(String));
      const userDeptIds = new Set((user?.department_ids ?? []).map(String));
      const userProjectIds = new Set((user?.project_ids ?? []).map(String));

      const visible = response.data.filter((p) => {
        if (isAdmin || isTechnician) return true;

        // 1️⃣ Usuario asignado directamente
        if (p.user_ids?.map(String).includes(userIdStr)) return true;

        // 2️⃣ Departamento asignado
        if (
          p.department_ids?.some((d) => userDeptIds.has(String(d)))
        )
          return true;

        // 3️⃣ Hotel asignado (cuando el proyecto tiene hotel_id)
        if (p.hotel_id && userHotelIds.has(String(p.hotel_id))) return true;

        // 4️⃣ Proyectos asignados por referencia directa (p.id)
        if (userProjectIds.has(String(p.id))) return true;

        return false;
      });

      setProjects(visible);
    } catch (err) {
      console.error('Error al cargar proyectos:', err);
      toast.error('Error al cargar los proyectos');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------- CREAR PROYECTO ---------------------- */
  const handleCreateProject = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await projectsAPI.create(newProject);
      toast.success('Proyecto creado correctamente');
      setDialogOpen(false);
      setNewProject({
        name: '',
        description: '',
        version: '1.0.0',
        user_ids: [],
        department_ids: [],
      });
      fetchProjects(); // refrescamos la lista
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear el proyecto');
    } finally {
      setCreating(false);
    }
  };

  /* ---------------------- FILTRO DE ESTADO ---------------------- */
  const handleFilterChange = (value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) newParams.set('status', value);
    else newParams.delete('status');
    setSearchParams(newParams);
    setStatusFilter(value);
  };

  /* ---------------------- STATUS BADGE ---------------------- */
  const getStatusBadge = (status) => {
    const statusConfig = {
      in_development: { label: 'En desarrollo', variant: 'default' },
      published: { label: 'Publicado', variant: 'secondary' },
      update_available: { label: 'Actualización', variant: 'outline' },
      archived: { label: 'Archivado', variant: 'outline' },
    };
    const cfg = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  /* ---------------------- BÚSQUEDA ---------------------- */
  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canCreate = isAdmin || isTechnician;

  /* ---------------------- RENDER ---------------------- */
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ---------------------- HEADER ---------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Back + Search */}
        <div className="flex items-center w-full sm:w-auto gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar proyectos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="search-projects"
            />
          </div>
        </div>

        {/* Botón crear proyecto (solo admin/tech) */}
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (open) setUserSearch(''); // reset buscador usuarios al abrir
          }}>
            <DialogTrigger asChild>
              <Button data-testid="create-project-btn">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Proyecto
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
              <form onSubmit={handleCreateProject}>
                <DialogHeader>
                  <DialogTitle>Nuevo Proyecto</DialogTitle>
                  <DialogDescription>
                    Cree un nuevo proyecto del departamento de sistemas
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  {/* Nombre */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre</Label>
                    <Input
                      id="name"
                      value={newProject.name}
                      onChange={(e) =>
                        setNewProject({ ...newProject, name: e.target.value })
                      }
                      placeholder="Nombre del proyecto"
                      required
                      data-testid="project-name-input"
                    />
                  </div>

                  {/* Descripción */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      value={newProject.description}
                      onChange={(e) =>
                        setNewProject({
                          ...newProject,
                          description: e.target.value,
                        })
                      }
                      placeholder="Descripción del proyecto"
                      rows={4}
                      required
                      data-testid="project-description-input"
                    />
                  </div>

                  {/* Versión */}
                  <div className="space-y-2">
                    <Label htmlFor="version">Versión</Label>
                    <Input
                      id="version"
                      value={newProject.version}
                      onChange={(e) =>
                        setNewProject({ ...newProject, version: e.target.value })
                      }
                      placeholder="1.0.0"
                      data-testid="project-version-input"
                    />
                  </div>

                  {/* ----------------- ASIGNACIÓN DE USUARIOS ----------------- */}
                  <div className="space-y-2">
                    <Label>Asignar a usuarios</Label>

                    {/* Buscador interno de usuarios */}
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar usuarios..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-9"
                        data-testid="user-search-input"
                      />
                    </div>

                    <div className="border rounded-sm p-3 max-h-32 overflow-y-auto">
                      {users
                        .filter((u) => {
                          const term = `${u.name} ${u.email}`.toLowerCase();
                          return term.includes(userSearch.toLowerCase());
                        })
                        .map((u) => (
                          <div key={u.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`proj-user-${u.id}`}
                              checked={newProject.user_ids?.includes(u.id) ?? false}
                              onCheckedChange={(checked) => {
                                const cur = newProject.user_ids || [];
                                if (checked) {
                                  setNewProject({
                                    ...newProject,
                                    user_ids: [...cur, u.id],
                                  });
                                } else {
                                  setNewProject({
                                    ...newProject,
                                    user_ids: cur.filter((id) => id !== u.id),
                                  });
                                }
                              }}
                            />
                            <label htmlFor={`proj-user-${u.id}`} className="text-sm">
                              {u.name} ({u.email})
                            </label>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* ----------------- ASIGNACIÓN DE DEPARTAMENTOS ----------------- */}
                  <div className="space-y-2">
                    <Label>Asignar a departamentos</Label>
                    <div className="border rounded-sm p-3 max-h-32 overflow-y-auto">
                      {departments.map((d) => (
                        <div key={d.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`proj-dept-${d.id}`}
                            checked={newProject.department_ids?.includes(d.id) ?? false}
                            onCheckedChange={(checked) => {
                              const cur = newProject.department_ids || [];
                              if (checked) {
                                setNewProject({
                                  ...newProject,
                                  department_ids: [...cur, d.id],
                                });
                              } else {
                                setNewProject({
                                  ...newProject,
                                  department_ids: cur.filter((id) => id !== d.id),
                                });
                              }
                            }}
                          />
                          <label htmlFor={`proj-dept-${d.id}`} className="text-sm">
                            {d.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={creating} data-testid="submit-project-btn">
                    {creating ? 'Creando...' : 'Crear Proyecto'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* ---------------------- BARRA DE ESTADOS ---------------------- */}
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
          </Button>
        ))}
      </div>

      {/* ---------------------- TABLA DE PROYECTOS ---------------------- */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Versión</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {user?.role === 'hotel_user' && !projects.length
                      ? 'No tienes proyectos asignados. Pide al administrador que te asigne algunos (Admin → Users → project_ids).'
                      : 'No se encontraron proyectos con los filtros actuales'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredProjects.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/projects/${project.id}`)}
                    data-testid={`project-row-${project.id}`}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {project.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{project.version}</TableCell>
                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {new Date(project.created_at).toLocaleDateString('es-ES')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectsPage;

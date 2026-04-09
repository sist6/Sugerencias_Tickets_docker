// src/pages/UsersPage.jsx
import React, { useState, useEffect } from "react";
import {
  usersAPI,
  hotelsAPI,
  departmentsAPI,
  projectsAPI,
} from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";

/* -------------------- UI COMPONENTS -------------------- */
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
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
} from "../../components/ui/alert-dialog";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Separator } from "../../components/ui/separator";
import { Alert, AlertDescription } from "../../components/ui/alert";

/* Helper for concatenating classNames (shadcn‑ui style) */
import { cn } from "../../lib/utils";

/* ------------------------------------------------------- */
/*  Active / Inactive toggle (muñequito verde‑rojo)      */
/* ------------------------------------------------------- */
export const ActiveToggle = ({
  value,
  onChange,
  disabled = false,
  className = "",
}) => {
  const toggle = () => {
    if (!disabled) onChange(!value);
  };

  return (
    <div
      role="switch"
      aria-checked={value}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      }}
      onClick={toggle}
      className={cn(
        "relative w-14 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300",
        value ? "bg-green-300 dark:bg-green-600" : "bg-red-300 dark:bg-red-600",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Muñequito activo */}
      <UserCheck
        className={cn(
          "absolute left-1 h-4 w-4",
          value ? "text-green-600" : "text-gray-400"
        )}
      />
      {/* Muñequito inactivo */}
      <UserX
        className={cn(
          "absolute right-1 h-4 w-4",
          !value ? "text-red-600" : "text-gray-400"
        )}
      />
      {/* Bolita que se desplaza */}
      <div
        className={cn(
          "w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300",
          value ? "translate-x-7" : "translate-x-0"
        )}
      />
    </div>
  );
};

/* ------------------------------------------------------- */
/*                         PAGE                           */
/* ------------------------------------------------------- */
const UsersPage = () => {
  const { isAdmin } = useAuth();

  /* ----------------------- STATE ----------------------- */
  const [users, setUsers] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [projectOptions, setProjectOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changePassword, setChangePassword] = useState(false);

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "central_user",
    hotel_ids: [],
    department_id: "",
    can_create_suggestions: false,
    can_access_tickets: true,
    project_ids: [],
    telf: "",
    is_active: true, // <‑‑ nuevo campo por defecto activo
  });

  /* --------------------- FETCH DATA -------------------- */
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, hotelsRes, deptsRes, projectsRes] = await Promise.all([
        usersAPI.getAll(),
        hotelsAPI.getAll(),
        departmentsAPI.getAll(),
        projectsAPI.getAll(),
      ]);
      setUsers(usersRes.data);
      setHotels(hotelsRes.data);
      setDepartments(deptsRes.data);
      setProjectOptions(projectsRes.data);
    } catch (err) {
      toast.error("Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------- CREATE USER -------------------- */
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const userData = { ...newUser };
      if (!userData.department_id) delete userData.department_id;
      await usersAPI.create(userData);
      toast.success("Usuario creado correctamente");
      setDialogOpen(false);
      setNewUser({
        name: "",
        email: "",
        password: "",
        role: "central_user",
        hotel_ids: [],
        department_id: "",
        can_create_suggestions: false,
        can_access_tickets: true,
        project_ids: [],
        telf: "",
        is_active: true,
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear el usuario");
    } finally {
      setCreating(false);
    }
  };

  /* ------------------- UPDATE USER -------------------- */
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    /* Validaciones de contraseña */
    if (changePassword) {
      if (!newPassword) {
        toast.error("Ingrese la nueva contraseña");
        return;
      }
      if (newPassword.length < 6) {
        toast.error("La contraseña debe tener al menos 6 caracteres");
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error("Las contraseñas no coinciden");
        return;
      }
    }

    setCreating(true);
    try {
      const payload = { ...selectedUser };

      if (!payload.department_id) delete payload.department_id;

      ["can_create_suggestions", "can_access_tickets", "is_active"].forEach(
        (k) => {
          if (typeof payload[k] === "number") payload[k] = Boolean(payload[k]);
        }
      );

      if (changePassword && newPassword) payload.password = newPassword;

      await usersAPI.update(selectedUser.id, payload);
      toast.success(
        changePassword
          ? "Usuario y contraseña actualizados"
          : "Usuario actualizado"
      );
      setEditDialogOpen(false);
      setSelectedUser(null);
      resetPasswordFields();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al actualizar");
    } finally {
      setCreating(false);
    }
  };

  const resetPasswordFields = () => {
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setChangePassword(false);
  };

  const openEditDialog = (user) => {
    setSelectedUser({ ...user });
    resetPasswordFields();
    setEditDialogOpen(true);
  };

  const handleDeleteUser = async (userId) => {
    try {
      await usersAPI.delete(userId);
      toast.success("Usuario eliminado");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar");
    }
  };

  /* ------------------- UI HELPERS -------------------- */
  const getRoleBadge = (role) => {
    const roleConfig = {
      admin: { label: "Administrador", variant: "default" },
      technician: { label: "Técnico", variant: "secondary" },
      hotel_user: { label: "Usuario Hotel", variant: "outline" },
      central_user: { label: "Usuario Central", variant: "outline" },
    };
    const cfg = roleConfig[role] || { label: role, variant: "outline" };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const getHotelNames = (hotelIds) => {
    if (!hotelIds || hotelIds.length === 0) return "-";
    return hotelIds
      .map((id) => hotels.find((h) => h.id === id)?.name || id)
      .join(", ");
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  /* -------------------------- JSX -------------------------- */
  return (
    <div className="space-y-6 animate-fade-in">
      {/* ---------- HEADER + CREATE BUTTON ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar usuarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="search-users"
          />
        </div>

        {/*  ------------------- CREATE DIALOG -------------------  */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-user-btn">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleCreateUser}>
              <DialogHeader>
                <DialogTitle>Crear Usuario</DialogTitle>
                <DialogDescription>
                  Agregue un nuevo usuario al sistema
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* ---------- Nombre ---------- */}
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, name: e.target.value })
                    }
                    placeholder="Nombre completo"
                    required
                  />
                </div>

                {/* ---------- Email ---------- */}
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    placeholder="usuario@sohohoteles.com"
                    required
                  />
                </div>

                {/* ---------- Teléfono ---------- */}
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={newUser.telf}
                    onChange={(e) =>
                      setNewUser({ ...newUser, telf: e.target.value })
                    }
                    placeholder="+34 600 123 456"
                  />
                </div>

                {/* ---------- Contraseña ---------- */}
                <div className="space-y-2">
                  <Label>Contraseña</Label>
                  <Input
                    type="password"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                    placeholder="••••••••"
                    required
                  />
                </div>

                {/* ---------- Rol ---------- */}
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) =>
                      setNewUser({
                        ...newUser,
                        role: value,
                        hotel_ids: [],
                        department_id: "",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isAdmin && (
                        <SelectItem value="admin">Administrador</SelectItem>
                      )}
                      <SelectItem value="technician">Técnico</SelectItem>
                      <SelectItem value="hotel_user">Usuario Hotel</SelectItem>
                      <SelectItem value="central_user">Usuario Central</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ---------- Departamento (solo hotel_user & central_user) ---------- */}
                {(newUser.role === "hotel_user" ||
                  newUser.role === "central_user") && (
                  <div className="space-y-2">
                    <Label>Departamento</Label>
                    <Select
                      value={newUser.department_id}
                      onValueChange={(value) =>
                        setNewUser({ ...newUser, department_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* ---------- Hoteles asignados (solo hotel_user) ---------- */}
                {newUser.role === "hotel_user" && (
                  <div className="space-y-2">
                    <Label>Hoteles asignados</Label>
                    <div className="border rounded-sm p-3 max-h-32 overflow-y-auto space-y-2">
                      {hotels.map((hotel) => (
                        <div key={hotel.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`hotel-${hotel.id}`}
                            checked={newUser.hotel_ids.includes(hotel.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewUser({
                                  ...newUser,
                                  hotel_ids: [...newUser.hotel_ids, hotel.id],
                                });
                              } else {
                                setNewUser({
                                  ...newUser,
                                  hotel_ids: newUser.hotel_ids.filter(
                                    (id) => id !== hotel.id
                                  ),
                                });
                              }
                            }}
                          />
                          <label
                            htmlFor={`hotel-${hotel.id}`}
                            className="text-sm"
                          >
                            {hotel.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ---------- Permisos ---------- */}
                <div className="space-y-3">
                  <Label>Permisos</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="can_access_tickets"
                      checked={newUser.can_access_tickets}
                      onCheckedChange={(checked) =>
                        setNewUser({
                          ...newUser,
                          can_access_tickets: checked,
                        })
                      }
                    />
                    <label htmlFor="can_access_tickets" className="text-sm">
                      Acceso a tickets
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="can_create_suggestions"
                      checked={newUser.can_create_suggestions}
                      onCheckedChange={(checked) =>
                        setNewUser({
                          ...newUser,
                          can_create_suggestions: checked,
                        })
                      }
                    />
                    <label htmlFor="can_create_suggestions" className="text-sm">
                      Crear Propuestas
                    </label>
                  </div>
                </div>

                {/* ---------- Proyectos visibles (si puede crear sugerencias) ---------- */}
                {newUser.can_create_suggestions && (
                  <div className="space-y-2">
                    <Label>Proyectos visibles</Label>
                    <div className="border rounded-sm p-3 max-h-32 overflow-y-auto space-y-2">
                      {projectOptions.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`proj-${p.id}`}
                            checked={newUser.project_ids.includes(p.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewUser({
                                  ...newUser,
                                  project_ids: [...newUser.project_ids, p.id],
                                });
                              } else {
                                setNewUser({
                                  ...newUser,
                                  project_ids: newUser.project_ids.filter(
                                    (id) => id !== p.id
                                  ),
                                });
                              }
                            }}
                          />
                          <label htmlFor={`proj-${p.id}`} className="text-sm">
                            {p.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ---------- Estado activo / inactivo ---------- */}
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <ActiveToggle
                    value={newUser.is_active}
                    onChange={(v) =>
                      setNewUser({ ...newUser, is_active: v })
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creando..." : "Crear Usuario"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* --------------------------- USERS TABLE --------------------------- */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Hoteles</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No se encontraron usuarios
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id || user.sub}>
                    <TableCell className="font-medium">
                      {user.name}
                    </TableCell>
                    <TableCell className="text-sm">{user.email}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">
                      {getHotelNames(user.hotel_ids)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.is_active ? "secondary" : "outline"}
                      >
                        {user.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  ¿Eliminar usuario?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleDeleteUser(user.id || user.sub)
                                  }
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* -------------------- EDIT USER DIALOG -------------------- */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) resetPasswordFields();
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleUpdateUser}>
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>
                Modifique los datos del usuario seleccionado
              </DialogDescription>
            </DialogHeader>

            {selectedUser && (
              <div className="grid gap-4 py-4">
                {/* ---------- Nombre ---------- */}
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={selectedUser.name}
                    onChange={(e) =>
                      setSelectedUser({
                        ...selectedUser,
                        name: e.target.value,
                      })
                    }
                  />
                </div>

                {/* ---------- Email ---------- */}
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={selectedUser.email}
                    onChange={(e) =>
                      setSelectedUser({
                        ...selectedUser,
                        email: e.target.value,
                      })
                    }
                  />
                </div>

                {/* ---------- Teléfono ---------- */}
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={selectedUser.telf}
                    onChange={(e) =>
                      setSelectedUser({
                        ...selectedUser,
                        telf: e.target.value,
                      })
                    }
                  />
                </div>

                {/* ---------- Rol ---------- */}
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select
                    value={selectedUser.role}
                    onValueChange={(value) =>
                      setSelectedUser({ ...selectedUser, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isAdmin && (
                        <SelectItem value="admin">Administrador</SelectItem>
                      )}
                      <SelectItem value="technician">Técnico</SelectItem>
                      <SelectItem value="hotel_user">Usuario Hotel</SelectItem>
                      <SelectItem value="central_user">
                        Usuario Central
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ---------- Departamento (para hotel_user & central_user) ---------- */}
                {(selectedUser.role === "hotel_user" ||
                  selectedUser.role === "central_user") && (
                  <div className="space-y-2">
                    <Label>Departamento</Label>
                    <Select
                      value={selectedUser.department_id || ""}
                      onValueChange={(value) =>
                        setSelectedUser({
                          ...selectedUser,
                          department_id: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* ---------- Hoteles (solo hotel_user) ---------- */}
                {selectedUser.role === "hotel_user" && (
                  <div className="space-y-2">
                    <Label>Hoteles asignados</Label>
                    <div className="border rounded-sm p-3 max-h-32 overflow-y-auto space-y-2">
                      {hotels.map((hotel) => (
                        <div key={hotel.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`edit-hotel-${hotel.id}`}
                            checked={
                              selectedUser.hotel_ids?.includes(hotel.id) || false
                            }
                            onCheckedChange={(checked) => {
                              const cur = selectedUser.hotel_ids || [];
                              if (checked) {
                                setSelectedUser({
                                  ...selectedUser,
                                  hotel_ids: [...cur, hotel.id],
                                });
                              } else {
                                setSelectedUser({
                                  ...selectedUser,
                                  hotel_ids: cur.filter((id) => id !== hotel.id),
                                });
                              }
                            }}
                          />
                          <label
                            htmlFor={`edit-hotel-${hotel.id}`}
                            className="text-sm"
                          >
                            {hotel.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ---------- Proyectos visibles (si puede crear sugerencias) ---------- */}
                {selectedUser.can_create_suggestions && (
                  <div className="space-y-2">
                    <Label>Proyectos visibles</Label>
                    <div className="border rounded-sm p-3 max-h-32 overflow-y-auto space-y-2">
                      {projectOptions.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`edit-proj-${p.id}`}
                            checked={
                              selectedUser.project_ids?.includes(p.id) ?? false
                            }
                            onCheckedChange={(checked) => {
                              const cur = selectedUser.project_ids || [];
                              if (checked) {
                                setSelectedUser({
                                  ...selectedUser,
                                  project_ids: [...cur, p.id],
                                });
                              } else {
                                setSelectedUser({
                                  ...selectedUser,
                                  project_ids: cur.filter((id) => id !== p.id),
                                });
                              }
                            }}
                          />
                          <label htmlFor={`edit-proj-${p.id}`} className="text-sm">
                            {p.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator className="my-2" />

                {/* ---------- Estado (activo / inactivo) ---------- */}
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <ActiveToggle
                    value={selectedUser.is_active}
                    onChange={(v) =>
                      setSelectedUser({ ...selectedUser, is_active: v })
                    }
                  />
                </div>

                <Separator className="my-2" />

                {/* ---------- Cambio de contraseña ---------- */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Cambiar Contraseña
                    </Label>
                    <Checkbox
                      id="change_password"
                      checked={changePassword}
                      onCheckedChange={(checked) => {
                        setChangePassword(checked);
                        if (!checked) {
                          setNewPassword("");
                          setConfirmPassword("");
                        }
                      }}
                    />
                  </div>

                  {changePassword && (
                    <div className="space-y-3 p-3 border rounded-sm bg-muted/30">
                      <Alert className="py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Por seguridad, las contraseñas se almacenan encriptadas
                          y no pueden mostrarse. Solo puede establecer una
                          nueva contraseña.
                        </AlertDescription>
                      </Alert>

                      {/* Nueva contraseña */}
                      <div className="space-y-2">
                        <Label htmlFor="new_password">
                          Nueva Contraseña
                        </Label>
                        <div className="relative">
                          <Input
                            id="new_password"
                            type={showNewPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                            {showNewPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Confirmar contraseña */}
                      <div className="space-y-2">
                        <Label htmlFor="confirm_password">
                          Confirmar Contraseña
                        </Label>
                        <div className="relative">
                          <Input
                            id="confirm_password"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repita la contraseña"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() =>
                              setShowConfirmPassword(!showConfirmPassword)
                            }
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>

                        {confirmPassword && newPassword !== confirmPassword && (
                          <p className="text-xs text-destructive">
                            Las contraseñas no coinciden
                          </p>
                        )}
                        {confirmPassword &&
                          newPassword === confirmPassword &&
                          newPassword.length >= 6 && (
                            <p className="text-xs text-green-600">
                              Las contraseñas coinciden
                            </p>
                          )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ---------- Permisos ---------- */}
                <div className="space-y-3">
                  <Label>Permisos</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="edit_can_access_tickets"
                      checked={selectedUser.can_access_tickets}
                      onCheckedChange={(checked) =>
                        setSelectedUser({
                          ...selectedUser,
                          can_access_tickets: checked,
                        })
                      }
                    />
                    <label
                      htmlFor="edit_can_access_tickets"
                      className="text-sm"
                    >
                      Acceso a tickets
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="edit_can_create_suggestions"
                      checked={selectedUser.can_create_suggestions}
                      onCheckedChange={(checked) =>
                        setSelectedUser({
                          ...selectedUser,
                          can_create_suggestions: checked,
                        })
                      }
                    />
                    <label
                      htmlFor="edit_can_create_suggestions"
                      className="text-sm"
                    >
                      Crear Propuestas
                    </label>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;

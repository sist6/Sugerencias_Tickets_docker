// src/pages/SuggestionDetailPage.js
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { suggestionsAPI, projectsAPI, usersAPI } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
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
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import {
  ArrowLeft,
  Clock,
  User,
  Target,
  FolderKanban,
  Trash2,
  XCircle,
  Paperclip,
  Download,
  Phone,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Página que muestra la información de una propuesta.
 *
 * El componente maneja todo el flujo de aprobar, crear proyecto,
 * cancelar, publicar o eliminar (solo admin). Cuando no hay proyecto
 * asociado la opción “Aprobar y crear proyecto” muestra un diálogo
 * modal que permite crear un nuevo proyecto. En la tarjeta “Detalles”
 * también se muestra el creador de la propuesta y, si existe, el
 * nombre del proyecto vinculado.
 */
const SuggestionDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isTechnician } = useAuth();

  /* ------------------------------------ STATE ------------------------------------ */
  const [suggestion, setSuggestion] = useState(null);
  const [project, setProject] = useState(null); // <-- NUEVO --------------
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    version: "1.0.0",
  });

  /* -------------------------------- ATTACHMENTS -------------------------------- */
  const [attachments, setAttachments] = useState([]);

  /* ------------------------------------------ FETCH ------------------------------------------ */
  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const res = await suggestionsAPI.getById(id);
      setSuggestion(res.data);

      // Pre‑llenar formulario proyecto (en caso de que se necesite crear)
      setNewProject({
        name: res.data.title,
        description: res.data.description,
        version: "1.0.0",
      });

      // Cargar proyecto asociado (si lo tiene)
      if (res.data.project_id) {
        try {
          const proj = await projectsAPI.getById(res.data.project_id);
          setProject(proj.data);
        } catch (pErr) {
          console.warn("Proyecto no encontrado o error al cargarlo", pErr);
        }
      }

      await fetchAttachments(res.data.id);

      // -------------------------------------------------
      // CARGAR LISTA DE TÉCNICOS / ADMIN (solo si tiene permiso)
      // -------------------------------------------------
      if (isAdmin || isTechnician) {
        try {
          const usersRes = await usersAPI.getAll();
          setTechnicians(
            usersRes.data.filter(
              (u) => u.role === "technician" || u.role === "admin"
            )
          );
        } catch (uErr) {
          console.warn("Error al cargar usuarios técnicos", uErr);
        }
      }
    } catch (err) {
      toast.error("Error al cargar la propuesta");
      navigate("/suggestions");
    } finally {
      setLoading(false);
    }
  };

  const fetchAttachments = async (suggestionId) => {
    try {
      const data = await suggestionsAPI.listAttachments(suggestionId);
      setAttachments(data?.data ?? []);
    } catch (err) {
      toast.error("Error al cargar archivos adjuntos");
    }
  };

  /* -------------------------------- ---------- DELETE ATTACHMENT -------------------------------- */
  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await suggestionsAPI.deleteAttachment(attachmentId);
      toast.success("Adjunto eliminado");
      if (suggestion) await fetchAttachments(suggestion.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar adjunto");
    }
  };

  /* -------------------------------- ---------- DELETE SUGGESTION -------------------------------- */
  const handleDelete = async () => {
    try {
      await suggestionsAPI.delete(id);
      toast.success("Propuesta eliminada");
      navigate("/suggestions");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar la propuesta");
    }
  };

  /* -------------------------------- ---------- STATUS ------------------------------------------------- */
  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      await suggestionsAPI.update(id, { status: newStatus });
      setSuggestion({ ...suggestion, status: newStatus });
      toast.success("Estado actualizado");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al actualizar");
    } finally {
      setUpdating(false);
    }
  };

  const handleTake = async () => {
    setUpdating(true);
    try {
      await suggestionsAPI.take(id);
      await fetchData();
      toast.success("Propuesta tomada para estudio");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al tomar la propuesta");
    } finally {
      setUpdating(false);
    }
  };

  /* ------------------------------------------ CANCEL --------------------------------------- */
  const openCancelDialog = (id) => {
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancelReason.trim()) return;
    setUpdating(true);
    try {
      await suggestionsAPI.update(id, {
        status: "cancelled",
        cancellation_reason: cancelReason.trim(),
      });
      await fetchData();
      toast.success("Propuesta cancelada");
      setCancelDialogOpen(false);
      setCancelReason("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al cancelar");
    } finally {
      setUpdating(false);
    }
  };

  /* ------------------------------------------ CREATE PROJECT -------------------------------- */
  const handleCreateProject = async () => {
    setCreatingProject(true);
    try {
      const projectRes = await projectsAPI.create({
        ...newProject,
        suggestion_id: id,
      });

      /* Vincula la propuesta con el proyecto recién creado */
      await suggestionsAPI.update(id, {
        status: "in_development",
        project_id: projectRes.data.id,
      });

      toast.success("Proyecto creado y propuesta actualizada");
      setProjectDialogOpen(false);
      navigate(`/projects/${projectRes.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear el proyecto");
    } finally {
      setCreatingProject(false);
    }
  };

  /* ------------------------------------------ UTILS ------------------------------------- */
  const getStatusBadge = (status) => {
    const statusConfig = {
      new: { label: "Nueva", variant: "default" },
      in_study: { label: "En estudio", variant: "secondary" },
      in_development: { label: "En desarrollo", variant: "secondary" },
      cancelled: { label: "Cancelada", variant: "destructive" },
      published: { label: "Publicada", variant: "outline" },
    };
    const config = statusConfig[status] ?? { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

    const getContacto = () => {
    if (suggestion?.telf) {
      return suggestion.email ? `${suggestion.telf}/${suggestion.email}` : suggestion.telf;
    }
    const userObj = technicians.find((u) => u.id === suggestion?.created_by);
    if (!userObj) return "Desconocido";
    const phone = userObj.telf?.trim();
    const email = userObj.email?.trim();
    if (phone) return email ? `${phone} / ${email}` : phone;
    if (email) return email;
  };


  const canManage = isAdmin || isTechnician;
  const canTake = canManage && suggestion?.status === "new";
  const canApprove = canManage && suggestion?.status === "in_study";
  const canPublish = canManage && suggestion?.status === "in_development";
  const canDeleteAttachment =
    isAdmin || suggestion?.created_by === user?.id;

  /* ------------------------------------------- RENDER --------------------------------------- */
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!suggestion) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Propuesta no encontrada</p>
        <Button variant="link" onClick={() => navigate("/suggestions")}>
          Volver a propuestas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* -------------------- HEADER --------------------------------- */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/suggestions")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{suggestion.title}</h1>
            {getStatusBadge(suggestion.status)}
          </div>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            ID: {suggestion.id}
          </p>
        </div>
      </div>

      {/* -------------------- MAIN + ATTACHMENTS + ACTIONS --------------------- */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Descripción */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descripción</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">
                {suggestion.description}
              </p>
            </CardContent>
          </Card>

          {/* Beneficios */}
          {suggestion.benefits && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Beneficios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">
                  {suggestion.benefits}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Adjuntos */}
          {attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Adjuntos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {attachments.map((att) => (
                    <li key={att.id} className="flex items-center gap-2">
                      <span className="flex-1 truncate">
                        {att.filename || att.file_name || att.name}
                      </span>
                      {att.url && (
                        <a
                          href={`${process.env.REACT_APP_BACKEND_URL}${att.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                          data-testid={`download-attachment-${att.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {canDeleteAttachment && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAttachment(att.id)}
                          aria-label="Eliminar adjunto"
                          data-testid={`delete-attachment-${att.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Motivo de cancelación */}
          {suggestion.status === "cancelled" &&
            suggestion.cancellation_reason && (
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    Motivo de Cancelación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">
                    {suggestion.cancellation_reason}
                  </p>
                </CardContent>
              </Card>
            )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Detalles */}
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
                    {new Date(suggestion.created_at).toLocaleString("es-ES")}
                  </p>
                </div>
              </div>

              {suggestion.created_by && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Creado por</p>
                  <p className="text-sm font-mono">
                    {suggestion.created_by_name}
                  </p>
                </div>
              </div>
              )}
              {canManage && (
                <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Contacto</p>
                  <p className="text-sm font-medium">{getContacto()}</p>
                </div>
              </div>)}
              
            {/* Asignado (tomado) */}
            {suggestion.assigned_to && suggestion.assigned_to_name && canManage && (
              
              
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Tomado por</p>
                  <p className="text-sm font-mono">{suggestion.assigned_to_name}</p>
                </div>
              </div>
            )}
              {project && (
                <div className="flex items-center gap-3">
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Proyecto vinculado
                    </p>
                    <Button
                      variant="link"
                      className="h-auto p-0 text-sm"
                      onClick={() =>
                        navigate(`/projects/${project.id}`)
                      }
                    >
                      {project.name || "Proyecto"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Acciones */}
          {(isAdmin || (isTechnician && suggestion.assigned_to === user?.id)) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Tomar */}
                {canTake && (
                  <Button
                    className="w-full"
                    onClick={handleTake}
                    disabled={updating}
                    data-testid="take-suggestion-btn"
                  >
                    Tomar propuesta para estudio
                  </Button>
                )}

                {/* Aprobar */}
                {canApprove && (
                  <>
                    {/* \→ Aprobar sin crear proyecto */}
                    <Button
                      className="w-full"
                      onClick={() =>
                        handleStatusChange("in_development")
                      }
                      disabled={updating}
                      data-testid="approve-btn"
                    >
                      Aprobar
                    </Button>

                    {/*  Si NO tiene proyecto → dialogo crear proyecto */}
                    {!project && (
                      <Dialog
                        open={projectDialogOpen}
                        onOpenChange={setProjectDialogOpen}
                      >
                        <DialogTrigger asChild>
                          <Button
                            className="w-full"
                            disabled={updating}
                            data-testid="approve-create-btn"
                          >
                            Aprobar y crear proyecto
                          </Button>
                        </DialogTrigger>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Crear Proyecto</DialogTitle>
                            <DialogDescription>
                              Se creará un proyecto basado en esta propuesta.
                            </DialogDescription>
                          </DialogHeader>

                          <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                              <Label>Nombre del proyecto</Label>
                              <Input
                                value={newProject.name}
                                onChange={(e) =>
                                  setNewProject({
                                    ...newProject,
                                    name: e.target.value,
                                  })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Descripción</Label>
                              <Textarea
                                rows={3}
                                value={newProject.description}
                                onChange={(e) =>
                                  setNewProject({
                                    ...newProject,
                                    description: e.target.value,
                                  })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Versión inicial</Label>
                              <Input
                                value={newProject.version}
                                onChange={(e) =>
                                  setNewProject({
                                    ...newProject,
                                    version: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>

                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setProjectDialogOpen(false)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              onClick={handleCreateProject}
                              disabled={creatingProject}
                            >
                              {creatingProject ? "Creando…" : "Crear Proyecto"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}

                    {/* Cancelar */}
                    <Dialog
                      open={cancelDialogOpen}
                      onOpenChange={setCancelDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={updating}
                        >
                          Cancelar propuesta
                        </Button>
                      </DialogTrigger>

                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Cancelar propuesta</DialogTitle>
                          <DialogDescription>
                            Indique el motivo por el cual no es viable esta
                            propuesta.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="py-4">
                          <Label>Motivo de cancelación</Label>
                          <Textarea
                            rows={4}
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Explique por qué no es viable..."
                            className="mt-2"
                          />
                        </div>

                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setCancelDialogOpen(false)}
                          >
                            Volver
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleCancelConfirm}
                            disabled={updating || !cancelReason.trim()}
                          >
                            Cancelar propuesta
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                )}

                {/* Publicar */}
                {canPublish && (
                  <Button
                    className="w-full"
                    onClick={() => handleStatusChange("published")}
                    disabled={updating}
                    data-testid="publish-btn"
                  >
                    Marcar como publicada
                  </Button>
                )}

                {/* Delete (solo admin) */}
                {isAdmin && (
                  <>
                    <Separator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="w-full"
                          data-testid="delete-btn"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar Propuesta
                        </Button>
                      </AlertDialogTrigger>

                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            ¿Eliminar Propuesta?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará
                            permanentemente la propuesta.
                          </AlertDialogDescription>
                        </AlertDialogHeader>

                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>
                            Eliminar
                          </AlertDialogAction>
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

export default SuggestionDetailPage;

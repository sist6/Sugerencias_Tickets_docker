// src/pages/admin/SolutionTypePage.js
import React, { useEffect, useState, useMemo } from "react";
import { solutionTypesAPI, ticketTypesAPI } from "../../lib/api";

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

import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Skeleton } from "../../components/ui/skeleton";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

import { Plus, Search, X, Tag } from "lucide-react";
import { toast } from "sonner";

/* --------------------------------------------------------------- *
 *  Utilidad: comparación superficial (order‑independent) de
 *  dos arreglos. Se aceptan null/undefined devolviendo false sólo
 *  cuando la longitud difiere.
 * --------------------------------------------------------------- */
const arraysEqual = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  const setB = new Set(b);
  for (const v of setA) if (!setB.has(v)) return false;
  return true;
};

const SolutionTypePage = () => {
  /* -------------------  Estado  ------------------- */
  const [solutionTypes, setSolutionTypes] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  // "" → placeholder; "all" → “Todas”; cualquier otro string = id del ticket type
  const [filterTicketType, setFilterTicketType] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newSolution, setNewSolution] = useState({
    name: "",
    description: "",
    incident_type_ids: [],
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [selectedSolution, setSelectedSolution] = useState(null);
  const [editedSolution, setEditedSolution] = useState({
    name: "",
    description: "",
    incident_type_ids: [],
  });

  /* -------------------  Carga de datos  ------------------- */
  const fetchSolutionTypes = async () => {
    try {
      const { data } = await solutionTypesAPI.getAll();
      setSolutionTypes(data);
    } catch (err) {
      toast.error("Error al cargar los tipos de solución");
    }
  };

  const fetchTicketTypes = async () => {
    try {
      const { data } = await ticketTypesAPI.getAll();
      setTicketTypes(data);
    } catch (err) {
      toast.error("Error al cargar los tipos de incidencia");
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchSolutionTypes(), fetchTicketTypes()]);
      setLoading(false);
    };
    loadAll();
  }, []);

  /* -------------------  Lógica de filtrado  ------------------- */
  const filteredSolutionTypes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    // Si filterTicketType es "" (placeholder) o "all" → sin filtro por ticket
    const filterId = filterTicketType && filterTicketType !== "all"
      ? filterTicketType               // ejemplo: "3"
      : null;                          // significa “no filtrar”

    return solutionTypes.filter((st) => {
      // ---- filtro por nombre ----
      const matchesTitle = !query ||
        (st.name?.toString().toLowerCase().includes(query));

      // ---- filtro por ticket type ----
      const matchesTicket = !filterId ||
        (Array.isArray(st.incident_type_ids) &&
          st.incident_type_ids.some((id) => String(id) === filterId));

      return matchesTitle && matchesTicket;
    });
  }, [solutionTypes, searchQuery, filterTicketType]);

  /* -------------------  Creación  ------------------- */
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await solutionTypesAPI.create({
        name: newSolution.name,
        description: newSolution.description,
        incident_type_ids: newSolution.incident_type_ids,
      });
      toast.success("Tipo de solución creado");
      setCreateOpen(false);
      setNewSolution({ name: "", description: "", incident_type_ids: [] });
      await fetchSolutionTypes();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear el tipo");
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleNewIncident = (id) => {
    setNewSolution((prev) => {
      const set = new Set(prev.incident_type_ids);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, incident_type_ids: Array.from(set) };
    });
  };

  /* -------------------  Edición  ------------------- */
  const openEditModal = (solution) => {
    setSelectedSolution(solution);
    setEditedSolution({
      name: solution.name ?? "",
      description: solution.description ?? "",
      incident_type_ids: solution.incident_type_ids
        ? [...solution.incident_type_ids]
        : [],
    });
    setEditOpen(true);
  };

  const closeEditModal = () => {
    setEditOpen(false);
    setSelectedSolution(null);
  };

  const toggleEditedIncident = (id) => {
    setEditedSolution((prev) => {
      const set = new Set(prev.incident_type_ids);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, incident_type_ids: Array.from(set) };
    });
  };

  const hasChanges = useMemo(() => {
    if (!selectedSolution) return false;
    const base = {
      name: selectedSolution.name ?? "",
      description: selectedSolution.description ?? "",
      incident_type_ids: selectedSolution.incident_type_ids ?? [],
    };
    const edited = editedSolution;
    return (
      base.name !== edited.name ||
      base.description !== edited.description ||
      !arraysEqual(base.incident_type_ids, edited.incident_type_ids)
    );
  }, [selectedSolution, editedSolution]);

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedSolution) return;
    setEditLoading(true);
    try {
      await solutionTypesAPI.update(selectedSolution.id, {
        name: editedSolution.name,
        description: editedSolution.description,
        incident_type_ids: editedSolution.incident_type_ids,
      });
      toast.success("Tipo de solución actualizado");
      closeEditModal();
      await fetchSolutionTypes();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al actualizar");
    } finally {
      setEditLoading(false);
    }
  };

  /* -------------------  Placeholder mientras carga  ------------------- */
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  /* -------------------  Render  ------------------- */
  return (
    <div className="space-y-6 animate-fade-in">
      {/* ---------- Header (búsqueda + filtro + crear) ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Búsqueda */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar solución..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="search-solutions"
          />
        </div>

        {/* Filtro por tipo de incidencia */}
        <Select
          value={filterTicketType}
          onValueChange={(v) => setFilterTicketType(v)}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Todas las incidencias" />
          </SelectTrigger>
          <SelectContent>
            {/* “Todas” no filtra */}
            <SelectItem value="all">Todas</SelectItem>
            {ticketTypes.map((tt) => (
              <SelectItem key={tt.id} value={String(tt.id)}>
                {tt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Botón para crear nuevo tipo de solución */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-solution-btn">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Tipo de Solución
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-lg">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Crear Tipo de Solución</DialogTitle>
                <DialogDescription>
                  Complete la información para el nuevo tipo de solución.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* Título */}
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    placeholder="Ej: Solución Temporal, Permanente"
                    value={newSolution.name}
                    onChange={(e) =>
                      setNewSolution((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                {/* Descripción */}
                <div className="space-y-2">
                  <Label>Pasos a seguir</Label>
                  <Textarea
                    placeholder="Breve descripción..."
                    rows={3}
                    value={newSolution.description}
                    onChange={(e) =>
                      setNewSolution((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Ticket types relacionados */}
                <div className="space-y-2">
                  <Label>Tipos de Incidencias Relacionados</Label>
                  <div className="grid max-h-48 gap-2 overflow-y-auto rounded border p-2">
                    {ticketTypes.map((tt) => (
                      <div key={tt.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`new-inc-${tt.id}`}
                          checked={newSolution.incident_type_ids.includes(tt.id)}
                          onCheckedChange={() => toggleNewIncident(tt.id)}
                        />
                        <label htmlFor={`new-inc-${tt.id}`} className="text-sm">
                          {tt.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? "Guardando..." : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ---------- Tabla de tipos de solución ---------- */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Incidencias Relacionadas</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredSolutionTypes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No se encontraron tipos de solución
                  </TableCell>
                </TableRow>
              ) : (
                filteredSolutionTypes.map((st) => (
                  <TableRow
                    key={st.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => openEditModal(st)}
                  >
                    {/* Título */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{st.name}</span>
                      </div>
                    </TableCell>

                    {/* Descripción corta */}
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {st.description
                        ? st.description.length > 30
                          ? `${st.description.slice(0, 30)}...`
                          : st.description
                        : "-"}
                    </TableCell>

                    {/* Incidencias relacionadas (labels) */}
                    <TableCell>
                      {st.incident_type_ids && st.incident_type_ids.length > 0 ? (
                        st.incident_type_ids.map((ttId) => {
                          const tt = ticketTypes.find((t) => t.id === ttId);
                          return (
                            <Badge
                              key={ttId}
                              className="mr-1 bg-primary/10 text-primary"
                            >
                              {tt?.name || ttId}
                            </Badge>
                          );
                        })
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ---------- Modal de edición ---------- */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) closeEditModal();
        }}
      >
        <DialogContent className="max-w-lg">
          <button
            onClick={closeEditModal}
            className="absolute right-2 top-2 rounded-full p-1 hover:bg-muted"
            aria-label="Cerrar"
          >
            
          </button>

          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle>Editar Tipo de Solución</DialogTitle>
              <DialogDescription>
                Modifique los datos y guarde cuando haya cambios.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Título */}
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={editedSolution.name}
                  onChange={(e) =>
                    setEditedSolution((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label>Pasos a seguir</Label>
                <Textarea
                  rows={3}
                  value={editedSolution.description}
                  onChange={(e) =>
                    setEditedSolution((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Ticket types relacionados */}
              <div className="space-y-2">
                <Label>Tipos de Incidencia Relacionados</Label>
                <div className="grid max-h-48 gap-2 overflow-y-auto rounded border p-2">
                  {ticketTypes.map((tt) => (
                    <div key={tt.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-inc-${tt.id}`}
                        checked={editedSolution.incident_type_ids.includes(
                          tt.id
                        )}
                        onCheckedChange={() => toggleEditedIncident(tt.id)}
                      />
                      <label htmlFor={`edit-inc-${tt.id}`} className="text-sm">
                        {tt.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={closeEditModal}
                disabled={editLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!hasChanges || editLoading}>
                {editLoading ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SolutionTypePage;

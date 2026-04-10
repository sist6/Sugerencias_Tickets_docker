// src/pages/HotelsPage.jsx
import React, { useState, useEffect } from 'react';
import { hotelsAPI } from '../../lib/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
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
} from '../../components/ui/alert-dialog';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Hotel
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

/* -------------------------------------------------------
   Active / Inactive toggle (Hotel verde / rojo)
   ------------------------------------------------------- */
export const ActiveToggle = ({
  value,
  onChange,
  disabled = false,
  className = '',
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
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle();
        }
      }}
      onClick={toggle}
      className={cn(
        'relative w-14 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300',
        value ? 'bg-green-300 dark:bg-green-600' : 'bg-red-300 dark:bg-red-600',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Hotel activo */}
      <Hotel
        className={cn(
          'absolute left-1 h-4 w-4',
          value ? 'text-green-600' : 'text-gray-400'
        )}
      />
      {/* Hotel inactivo */}
      <Hotel
        className={cn(
          'absolute right-1 h-4 w-4',
          !value ? 'text-red-600' : 'text-gray-400'
        )}
      />
      {/* bolita que se desplaza */}
      <div
        className={cn(
          'w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300',
          value ? 'translate-x-7' : 'translate-x-0'
        )}
      />
    </div>
  );
};

/* -------------------------------------------------------
   HOTELS PAGE
   ------------------------------------------------------- */
const HotelsPage = () => {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHotel, setSelectedHotel] = useState(null);

  const [newHotel, setNewHotel] = useState({
    name: '',
    code: '',
    address: '',
    is_active: true, // nuevo campo por defecto activo
  });

  /* --------------------------- FETCH --------------------------- */
  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchHotels = async () => {
    try {
      const response = await hotelsAPI.getAll();
      setHotels(response.data);
    } catch (err) {
      toast.error('Error al cargar los hoteles');
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------- CREATE -------------------------- */
  const handleCreateHotel = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await hotelsAPI.create(newHotel);
      toast.success('Hotel creado correctamente');
      setDialogOpen(false);
      setNewHotel({ name: '', code: '', address: '', is_active: true });
      fetchHotels();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear el hotel');
    } finally {
      setCreating(false);
    }
  };

  /* -------------------------- UPDATE -------------------------- */
  const handleUpdateHotel = async (e) => {
    e.preventDefault();
    if (!selectedHotel) return;

    setCreating(true);
    try {
      await hotelsAPI.update(selectedHotel.id, selectedHotel);
      toast.success('Hotel actualizado');
      setEditDialogOpen(false);
      setSelectedHotel(null);
      fetchHotels();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar');
    } finally {
      setCreating(false);
    }
  };

  /* -------------------------- DELETE -------------------------- */
  const handleDeleteHotel = async (hotelId) => {
    try {
      await hotelsAPI.delete(hotelId);
      toast.success('Hotel eliminado');
      fetchHotels();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar');
    }
  };

  /* --------------------------- FILTER -------------------------- */
  const filteredHotels = hotels.filter(
    (hotel) =>
      hotel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hotel.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  /* --------------------------- RENDER -------------------------- */
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + Crear Hotel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar hoteles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="search-hotels"
          />
        </div>

        {/* Crear Hotel Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-hotel-btn">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Hotel
            </Button>
          </DialogTrigger>

          <DialogContent>
            <form onSubmit={handleCreateHotel}>
              <DialogHeader>
                <DialogTitle>Crear Hotel</DialogTitle>
                <DialogDescription>
                  Añada un nuevo hotel al sistema
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* Nombre */}
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={newHotel.name}
                    onChange={(e) =>
                      setNewHotel({ ...newHotel, name: e.target.value })
                    }
                    placeholder="SOHO Hotel Madrid"
                    required
                  />
                </div>

                {/* Código */}
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input
                    value={newHotel.code}
                    onChange={(e) =>
                      setNewHotel({
                        ...newHotel,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="MAD01"
                    required
                  />
                </div>

                {/* Dirección */}
                <div className="space-y-2">
                  <Label>Dirección (opcional)</Label>
                  <Input
                    value={newHotel.address}
                    onChange={(e) =>
                      setNewHotel({ ...newHotel, address: e.target.value })
                    }
                    placeholder="Calle Gran Vía, 1"
                  />
                </div>

                {/* Estado activo / inactivo */}
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <ActiveToggle
                    value={newHotel.is_active}
                    onChange={(v) =>
                      setNewHotel({ ...newHotel, is_active: v })
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
                  {creating ? 'Creando...' : 'Crear Hotel'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabla de hoteles */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredHotels.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No se encontraron hoteles
                  </TableCell>
                </TableRow>
              ) : (
                filteredHotels.map((hotel) => (
                  <TableRow key={hotel.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Hotel className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{hotel.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{hotel.code}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {hotel.address || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={hotel.is_active ? 'secondary' : 'outline'}
                      >
                        {hotel.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {/* Editar */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedHotel({ ...hotel });
                            setEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        {/* Eliminar */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                ¿Eliminar hotel?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteHotel(hotel.id)}
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Editar Hotel Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <form onSubmit={handleUpdateHotel}>
            <DialogHeader>
              <DialogTitle>Editar Hotel</DialogTitle>
            </DialogHeader>

            {selectedHotel && (
              <div className="grid gap-4 py-4">
                {/* Nombre */}
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={selectedHotel.name}
                    onChange={(e) =>
                      setSelectedHotel({
                        ...selectedHotel,
                        name: e.target.value,
                      })
                    }
                  />
                </div>

                {/* Código */}
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input
                    value={selectedHotel.code}
                    onChange={(e) =>
                      setSelectedHotel({
                        ...selectedHotel,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>

                {/* Dirección */}
                <div className="space-y-2">
                  <Label>Dirección</Label>
                  <Input
                    value={selectedHotel.address || ''}
                    onChange={(e) =>
                      setSelectedHotel({
                        ...selectedHotel,
                        address: e.target.value,
                      })
                    }
                  />
                </div>

                {/* Estado activo / inactivo */}
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <ActiveToggle
                    value={selectedHotel.is_active}
                    onChange={(v) =>
                      setSelectedHotel({
                        ...selectedHotel,
                        is_active: v,
                      })
                    }
                  />
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
                {creating ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HotelsPage;

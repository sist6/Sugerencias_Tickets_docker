import React, { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationContext";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

/* -----------------------------------------------------------------
   Títulos que aparecen en el TopBar según la ruta actual
   ----------------------------------------------------------------- */
const pageTitles = {
  "/": "Dashboard",
  "/tickets": "Tickets",
  "/suggestions": "Propuestas",
  "/projects": "Proyectos",
  "/admin/users": "Gestión de Usuarios",
  "/admin/hotels": "Gestión de Hoteles",
  "/admin/departments": "Departamentos",
  "/admin/ticket-types": "Tipos de Ticket",
  "/admin/roles": "Roles",
  "/admin/ticketsreport": "Reporte de Tickets Solucionados",
  "/admin/maphotels": "Mapa SOHO",
  "/admin/solution-type": "Tipo de solución",
};

const DashboardLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  /* -----------------------------------------------------------------
     Estado del drawer (solo visible en pantallas < lg)
     ----------------------------------------------------------------- */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  /* -----------------------------------------------------------------
     Pantalla de carga
     ----------------------------------------------------------------- */
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  /* -----------------------------------------------------------------
     Si no hay usuario → redirige al login
     ----------------------------------------------------------------- */
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  /* -----------------------------------------------------------------
     Obtención del título que se muestra en el TopBar
     ----------------------------------------------------------------- */
  const getPageTitle = () => {
    if (pageTitles[location.pathname]) return pageTitles[location.pathname];
    if (location.pathname.startsWith("/tickets/")) return "Detalle de Ticket";
    if (location.pathname.startsWith("/suggestions/")) return "Detalle de Propuesta";
    if (location.pathname.startsWith("/projects/")) return "Detalle de Proyecto";
    return "SOHO Systems";
  };

  return (
    <NotificationProvider>
      {/* -------------------------------------------------------------
          Contenedor principal (relative para que el overlay se posicione
          correctamente)
          ------------------------------------------------------------- */}
      <div className="relative min-h-screen bg-background">

        {/* -------------------------------------------------------------
            SIDEBAR (drawer en móvil, fijo en escritorio)
            ------------------------------------------------------------- */}
        <div
          className={`
          fixed left-0 top-0 h-screen z-50 w-64 bg-background shadow-none
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <Sidebar />
        </div>

        {/* -------------------------------------------------------------
            Overlay (solo cuando el drawer está abierto en móvil)
            ------------------------------------------------------------- */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={toggleSidebar}
            aria-label="Cerrar sidebar"
          />
        )}

        {/* -------------------------------------------------------------
            CONTENIDO PRINCIPAL
            ------------------------------------------------------------- */}
        <div className="flex flex-col min-h-screen lg:ml-64">
          {/* TopBar recibe la función que abre/cierra el drawer */}
          <TopBar title={getPageTitle()} onMenuClick={toggleSidebar} />

          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
};

export default DashboardLayout;

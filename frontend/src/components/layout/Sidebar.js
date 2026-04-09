/*** src/components/Sidebar/Sidebar.js ***/
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  LayoutDashboard,
  Ticket,
  Lightbulb,
  FolderKanban,
  Users,
  Building2,
  Hotel,
  Settings,
  FileText,
  Tag,
  Shield,
  Map,
  ClipboardList,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { cn } from "../../lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";



const Sidebar = () => {
  const { LOGO_URL, logoWidth } = useTheme();
  const location = useLocation();
  const { user, isAdmin, isTechnician, canManageUsers } = useAuth();

  /* ---------- MENÚ PRINCIPAL ---------- */
  const mainNavItems = [
    {
      title: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      show: true,
    },
    {
      title: "Tickets",
      href: "/tickets",
      icon: Ticket,
      show: user?.can_access_tickets !== false,
    },
    {
      title: "Propuestas de Mejora",
      href: "/suggestions",
      icon: Lightbulb,
      show: isAdmin || isTechnician || user?.can_create_suggestions,
    },
    {
      title: "Proyectos",
      href: "/projects",
      icon: FolderKanban,
      show:
        isAdmin ||
        isTechnician ||
        user?.can_create_suggestions ||
        (user?.project_ids && user.project_ids.length > 0),
    },
  ];

  /* ---------- ADMIN ---------- */
  const adminNavItems = [
    {
      title: "Usuarios",
      href: "/admin/users",
      icon: Users,
      show: canManageUsers,
    },
    {
      title: "Hoteles",
      href: "/admin/hotels",
      icon: Hotel,
      show: isAdmin,
    },
    {
      title: "Departamentos",
      href: "/admin/departments",
      icon: Building2,
      show: isAdmin,
    },
  ];

  /* ---------- RECURSOS DE SISTEMAS ---------- */
  const recSis = [
    {
      title: "Reporte de Tickets",
      href: "/admin/ticketsreport",
      icon: FileText,
      show: isAdmin || isTechnician,
    },
    {
      title: "Mapa Soho",
      href: "/admin/maphotels",
      icon: Map,
      show: isAdmin || isTechnician,
    },
    {
      title: "Tipo de Solución",
      href: "/admin/solution-type",
      icon: ClipboardList,
      show: isAdmin || isTechnician,
    },
    {
      title: "Tipos de Ticket",
      href: "/admin/ticket-types",
      icon: Tag,
      show: isAdmin || isTechnician,
    },
    {
      title: "Manual Sistemas",
      href:
        "https://sohohoteles-my.sharepoint.com/personal/sistemas4_sohohoteles_com/_layouts/15/Doc.aspx?sourcedoc={d0b7a517-730b-4b68-9df5-fdec775ac65b}&action=edit&wd=target%28Agrear%20lector%20de%20documentos%20a%20usuario.one%7C5ac190eb-fd19-4086-bd22-9a8215c12459%2FReporte%20Policia%20ITC%20Barcelona%7Ccc9ab11d-6cf2-4590-8ff6-faa5add4cb75%2F%29&wdorigin=NavigationUrl",
      external: true,               // ← lo marcamos como externo
      target: "_blank",            // ← abre en nueva pestaña
      icon: BookOpen,
      show: isAdmin || isTechnician,
    },
  ];

  /* ---------- ÍTEM DE NAVEGACIÓN ---------- */
  const NavItem = ({ item }) => {
    if (!item.show) return null;

    // Si es un enlace externo renderizamos <a> en vez de <Link>
    if (item.external) {
      const Icon = item.icon;
      return (
        <a
          href={item.href}
          target={item.target ?? "_blank"}
          rel="noopener noreferrer"
          data-testid={`nav-${item.href
            .replace(/\//g, "-")
            .replace(/^-/, "")}`}
          className={cn("sidebar-item")}
        >
          <Icon className="h-4 w-4" />
          <span>{item.title}</span>
        </a>
      );
    }

    // Enlaces internos (router)
    const isActive =
      location.pathname === item.href ||
      (item.href !== "/" && location.pathname.startsWith(item.href));

    const Icon = item.icon;
    return (
      <Link
        to={item.href}
        data-testid={`nav-${item.href
          .replace(/\//g, "-")
          .replace(/^-/, "")}`}
        className={cn("sidebar-item", isActive && "active")}
      >
        <Icon className="h-4 w-4" />
        <span>{item.title}</span>
      </Link>
    );
  };

  /* ---------- RENDER ---------- */
  return (
    <aside className="h-full w-64 border-r border-border bg-background">
      <div className="flex h-full flex-col">
        {/* LOGO */}
        <div className="flex h-16 items-center justify-center border-b border-border px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={LOGO_URL} alt="SOHO Hoteles" className="h-10 w-[150px] object-contain" />
          </Link>
        </div>

        {/* NAVEGACIÓN */}
        <ScrollArea className="flex-1 px-3 py-4">
          {/* MENÚ PRINCIPAL */}
          <nav className="space-y-1">
            {mainNavItems.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}
          </nav>

          {/* RECURSOS DE SISTEMAS */}
          {(isAdmin || isTechnician) && (
            <>
              <Separator className="my-4" />
              <div className="px-3 py-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Recursos de Sistemas
                </h3>
              </div>
              <nav className="space-y-1">
                {recSis.map((item) => (
                  <NavItem key={item.href} item={item} />
                ))}
              </nav>
            </>
          )}

          {/* ADMINISTRACIÓN */}
          {(isAdmin || isTechnician) && (
            <>
              <Separator className="my-4" />
              <div className="px-3 py-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Administración
                </h3>
              </div>
              <nav className="space-y-1">
                {adminNavItems.map((item) => (
                  <NavItem key={item.href} item={item} />
                ))}
              </nav>
            </>
          )}
        </ScrollArea>

        {/* INFO USUARIO */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.role}
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

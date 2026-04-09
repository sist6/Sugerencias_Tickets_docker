/* src/components/TopBar.jsx */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  Bell,
  LogOut,
  User,
  ChevronDown,
  Check,
  Sun,
  Moon,
  Send,
  RefreshCcw,
  Menu,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Switch } from "../ui/switch";
import { cn } from "../../lib/utils";
import { useTelegram } from "../../hooks/useTelegram";

const TopBar = ({
  title,          // Título de la página (obligatorio)
  onMenuClick,   // Función que abre / cierra el drawer en móvil
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { notifications, markAsRead } = useNotifications();
  const { toggleTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);

  /* ---------- Telegram ---------- */
  const {
    linked,
    enabled,
    loading: telegramLoading,
    registerTelegram,
    toggleEnabled,
  } = useTelegram();

  const canControlTelegram = ["admin", "technician"].includes(
    (user?.role || "").toLowerCase()
  );

  const ticketNotifications = notifications.filter((n) =>
    n.type?.startsWith("ticket_")
  );
  const ticketUnreadCount = ticketNotifications.filter((n) => !n.is_read)
    .length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) markAsRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
      setNotifOpen(false);
    }
  };

  const getNotificationTypeStyles = (type) => {
    switch (type) {
      case "info":
        return "border-l-zinc-900 dark:border-zinc-400";
      case "success":
        return "border-l-emerald-600 dark:border-emerald-400";
      case "warning":
        return "border-l-amber-600 dark:border-amber-400";
      case "error":
        return "border-l-destructive dark:border-red-400";
      case "message":
        return "border-l-yellow-700 bg-amber-50/80 dark:border-yellow-400 dark:bg-yellow-950/30";
      case "project_new":
        return "border-l-purple-600 dark:border-purple-400";
      case "project_assigned":
        return "border-l-indigo-600 dark:border-indigo-400";
      case "suggestion_new":
        return "border-l-amber-600 bg-amber-50/80 dark:border-amber-400 dark:bg-yellow-950/30";
      case "suggestion_approved":
        return "border-l-emerald-600 dark:border-emerald-400";
      case "suggestion_suspended":
        return "border-l-rose-600 dark:border-rose-400";
      case "ticket_new":
        return "border-l-cyan-600 bg-amber-50/80 dark:border-cyan-400 dark:bg-yellow-950/30";
      case "ticket_assigned":
        return "border-l-sky-600 bg-amber-50/80 dark:border-sky-400 dark:bg-yellow-950/30";
      case "ticket_resolved":
        return "border-l-emerald-600 dark:border-emerald-400";
      case "ticket_awaiting":
        return "bg-amber-50/80 dark:bg-yellow-950/30";
      default:
        return "border-l-zinc-300 dark:border-zinc-500";
    }
  };

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-border bg-background flex flex-nowrap items-center px-4 md:px-6">
      {/* IZQUIERDA – botón de menú (solo móvil) */}
      <div className="flex items-center w-12 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Abrir menú"
          data-testid="sidebar-toggle-mobile"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* CENTRO – título centrado y truncado */}
      <div className="flex-1 min-w-0 flex items-center justify-left px-2">
        <h1 className="text-base sm:text-lg md:text-xl font-bold truncate text-center">
          {title}
        </h1>
      </div>

      {/* DERECHA – acciones (sin wrap) */}
      <div className="flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
        {/* NOTIFICACIONES */}
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              data-testid="notifications-btn"
            >
              <Bell className="h-5 w-5" />
              {ticketUnreadCount > 0 && (
                <Badge
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  variant="default"
                >
                  {ticketUnreadCount > 9 ? "9+" : ticketUnreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="font-semibold pb-2 dark:text-foreground flex items-center justify-between">
              Notificaciones de tickets
              {ticketUnreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.preventDefault();
                    Promise.all(ticketNotifications.map((n) => markAsRead(n.id)));
                  }}
                >
                  <Check className="mr-1 h-3 w-3" />
                  Marcar todas leídas
                </Button>
              )}
            </DropdownMenuLabel>

            <DropdownMenuSeparator />
            <ScrollArea className="h-72">
              {ticketNotifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground dark:text-muted-foreground/90">
                  No hay notificaciones de tickets
                </div>
              ) : (
                ticketNotifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 cursor-pointer border-l-4 hover:bg-accent dark:border-foreground/30 [&:hover]:bg-accent/80 dark:[&:hover]:bg-muted-foreground/20 focus:bg-accent dark:focus:bg-muted-foreground/30",
                      getNotificationTypeStyles(notification.type)
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex w-full items-start justify-between">
                      <span className="font-medium text-sm">{notification.title}</span>
                      {!notification.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </span>
                    <span className="text-xs text-muted-foreground/70 font-mono">
                      {new Date(notification.created_at).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* DARK / LIGHT */}
        <div
          onClick={toggleTheme}
          className="relative w-14 h-7 flex items-center bg-muted rounded-full p-1 cursor-pointer transition-colors duration-300 dark:bg-zinc-700"
        >
          <Sun className="absolute left-1 h-4 w-4 text-yellow-500" />
          <Moon className="absolute right-1 h-4 w-4 text-blue-400" />
          <div
            className={cn(
              "w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300",
              "translate-x-0 dark:translate-x-7"
            )}
          />
        </div>

        {/* USER MENU */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2" data-testid="user-menu-btn">
              <div className="flex h-7 w-7 z-40 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <span className="hidden sm:inline-block text-sm">{user?.name}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="flex flex-col">
              <span>{user?.name}</span>
              <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
            </DropdownMenuLabel>

            {/* Telegram (solo admin / technician) */}
            {canControlTelegram && (
              <>
                <DropdownMenuSeparator />
                {/* Si no está enlazado */}
                {!linked ? (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      registerTelegram();
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Send className="h-4 w-4 text-sky-500" />
                    Conectar Telegram
                  </DropdownMenuItem>
                ) : (
                  <>
                    {/* Switch de activación */}
                    <div
                      className="flex items-center justify-between px-2 py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <Send className="h-4 w-4 text-sky-500" />
                        <span className="text-sm text-foreground">
                          Notificaciones en Telegram
                        </span>
                      </div>
                      <Switch
                        id="telegram-notif-switch"
                        checked={enabled}
                        onCheckedChange={toggleEnabled}
                        disabled={telegramLoading}
                      />
                    </div>

                    {/* Botón “Reconectar Telegram” */}
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        registerTelegram();
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <RefreshCcw className="h-4 w-4 text-sky-500" />
                      Reconectar Telegram
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} data-testid="logout-btn">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default TopBar;

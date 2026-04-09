// src/contexts/AuthContext.js
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { authAPI } from "../lib/api";
import {
  initWebSocket,
  closeSocket,
  setInMemoryToken,
  clearInMemoryToken,
} from "../lib/ws";
import { msalInstance } from "../config/msalConfig";

const AuthContext = createContext(null);
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchedRef = useRef(false);

  // -----------------------------------------------------------------
  //  Verificar sesión al montar la aplicación
  // -----------------------------------------------------------------
  const checkAuth = useCallback(async () => {
    console.log("🔄 checkAuth ejecutándose…");
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    try {
      const { data } = await authAPI.getMe({ _skipAuthError: true }); // GET /auth/me
      console.log("✅ checkAuth OK → user:", data?.user?.email);
      setUser(data.user);
    } catch (err) {
      console.log(
        "❌ checkAuth error →",
        err.response?.status,
        err.response?.data?.detail
      );
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // -----------------------------------------------------------------
  //  Login con email/contraseña
  // -----------------------------------------------------------------
  const login = async (email, password) => {
    setError(null);
    // authAPI.login devuelve la cookie de sesión (HttpOnly)
    const { data } = await authAPI.login(email, password);
    setUser(data.user);

    // No necesitamos token en JS: el WS usará la cookie automáticamente.
    // Sólo limpiamos cualquier token en memoria que pudiera quedar de
    // un flujo externo (p. ej. Microsoft).
    clearInMemoryToken();
    initWebSocket(); // ← sin token, confía en la cookie
    return data.user;
  };

  // -----------------------------------------------------------------
  //  Registro (opcional)
  // -----------------------------------------------------------------
  const register = async (payload) => {
    setError(null);
    const { data } = await authAPI.register(payload);
    setUser(data.user);
    // Igual que login: la cookie de sesión se crea en el backend.
    initWebSocket();
    return data.user;
  };

  // -----------------------------------------------------------------
  //  Logout
  // -----------------------------------------------------------------
  const logout = async () => {
    await authAPI.logout(); // borra la cookie del backend
    setUser(null);
    clearInMemoryToken();
    closeSocket();
  };

  // -----------------------------------------------------------------
  //  Permisos / roles
  // -----------------------------------------------------------------
  const isAdmin = user?.role === "admin";
  const isTechnician = user?.role === "technician";
  const isHotelUser = user?.role === "hotel_user";
  const isCentralUser = user?.role === "central_user";

  const canManageUsers = isAdmin || isTechnician;
  const canManageTickets = isAdmin || isTechnician;
  const canCreateSuggestions =
    isAdmin ||
    isTechnician ||
    isCentralUser ||
    user?.can_create_suggestions;
  const canViewProjects =
    isAdmin ||
    isTechnician ||
    user?.can_create_suggestions ||
    (user?.project_ids?.length > 0);

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    checkAuth,
    isAdmin,
    isTechnician,
    isHotelUser,
    isCentralUser,
    canManageUsers,
    canManageTickets,
    canCreateSuggestions,
    canViewProjects,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// src/pages/LoginPage.js
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { seedAPI } from "../lib/api";
import { authAPI } from "../lib/api";
import { msalInstance } from "../config/msalConfig";
import { setInMemoryToken } from "../lib/ws";

const LOGO_URL =
  "https://www.sohohoteles.com/wp-content/uploads/2026/03/Logos-SB-Trasparente-blanco_300-300x298-1.png";
const FONDO_URL =
  "https://www.sohohoteles.com/wp-content/uploads/2022/03/SOHO-31.jpg";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, error: authError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState("");

  const from = location.state?.from?.pathname || "/";

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const loginResponse = await msalInstance.loginPopup({
        scopes: ["User.Read"],
      });

      const {
        name,
        preferred_username: email,
        oid: microsoft_id,
      } = loginResponse.idTokenClaims;

      const { data } = await authAPI.microsoftAuth({
        email,
        name,
        microsoft_id,
      });

      // Guardamos el token que el backend ha devuelto (no está en una cookie)
      // para que el WS pueda enviarlo como query‑string.
      if (data?.token) {
        setInMemoryToken(data.token);
      }

      // Iniciamos el WS (el token en memoria será usado por ws.js)
      initWebSocket(data.token);

      navigate(from, { replace: true });
    } catch (err) {
      const mensaje =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err.message ||
        "Error con Microsoft";
      setError(mensaje);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    setSeedMessage("");
    try {
      const response = await seedAPI.seed();
      setSeedMessage(
        `Datos iniciales creados. Usuario: ${response.data.admin_email} / Contraseña: ${response.data.admin_password}`
      );
      setEmail("admin@sohohoteles.com");
      setPassword("admin123");
    } catch (err) {
      if (err.response?.data?.message === "Data already seeded") {
        setSeedMessage(
          "Los datos ya fueron inicializados. Use admin@sohohoteles.com / admin123"
        );
        setEmail("admin@sohohoteles.com");
        setPassword("admin123");
      } else {
        setSeedMessage("Error al inicializar datos");
      }
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-900 text-white">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        Iniciando sesión…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel – branding */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12 overflow-hidden">
        <img
          src={FONDO_URL}
          alt="Hotel"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-zinc-900/70"></div>
        <div className="relative max-w-md text-center">
          <img src={LOGO_URL} alt="SOHO" className="mx-auto h-40 mb-8" />
          <h1 className="text-3xl font-semibold text-white mb-4">
            SOHOBOUTIQUE HOTELS
          </h1>
          <h2 className="text-2xl text-zinc-300 mb-6 font-bold">
            Gestión de Tickets
          </h2>
          <p className="text-zinc-300 text-sm">
            Plataforma interna de gestión del departamento de sistemas.
          </p>
        </div>
      </div>

      {/* Right panel – login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <Card className="w-full max-w-md border-border shadow-sm">
          <CardHeader className="space-y-1 text-center">
            <div className="lg:hidden mb-4">
              <img src={LOGO_URL} alt="SOHO" className="mx-auto h-12" />
            </div>
            <CardTitle className="text-2xl font-semibold">
              Iniciar Sesión
            </CardTitle>
            <CardDescription>
              Acceda con sus credenciales corporativas
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {(error || authError) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error || authError}</AlertDescription>
                </Alert>
              )}

              {seedMessage && (
                <Alert>
                  <AlertDescription className="text-sm">
                    {seedMessage}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@sohohoteles.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando sesión…
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                o continúe con
              </span>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleMicrosoftLogin}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              Iniciar con Microsoft
            </Button>

          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;

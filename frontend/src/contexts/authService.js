/* -----------------------------------------------------------------
   authService.js
   -----------------------------------------------------------------
   Servicio muy ligero que permite:
   • Registrar la función de LogOut (normalmente la que viene del AuthContext)
   • Ejecutar esa función desde cualquier parte (p.ej. interceptores)
   • Opcionalmente registrar y disparar una función de login
   • Pub/Sub genérico para suscribirse a cambios de “user”
   ----------------------------------------------------------------- */

let logoutHandler = null;   // ← función que hará LogOut (limpia el AuthContext)
let loginHandler  = null;   // ← opcional: función que hará login (p.ej. setUser)

/* -----------------------------------------------------------------
   Registro de handlers
   ----------------------------------------------------------------- */
//eslint-disable-next-line @typescript-eslint/ban-types
export const setlogoutHandler = handler => {
  if (typeof handler !== "function") {
    console.warn("[authService] setlogoutHandler expects a function");
    return;
  }
  logoutHandler = handler;
};

export const clearlogoutHandler = () => {
  logoutHandler = null;
};

export const setLoginHandler = handler => {
  if (typeof handler !== "function") {
    console.warn("[authService] setLoginHandler expects a function");
    return;
  }
  loginHandler = handler;
};

export const clearLoginHandler = () => {
  loginHandler = null;
};

/* -----------------------------------------------------------------
   Ejecución de los handlers (para usarlos desde cualquier lugar)
   ----------------------------------------------------------------- */
export const dologout = () => {
  if (typeof logoutHandler === "function") {
    logoutHandler();
  } else {
    console.warn("[authService] dologout called but no handler is registered");
  }
};

export const doLogin = user => {
  if (typeof loginHandler === "function") {
    loginHandler(user);
  } else {
    console.warn("[authService] doLogin called but no handler is registered");
  }
};

/* -----------------------------------------------------------------
   Pub/Sub genérico (útil si algún componente quiere reaccionar a
   cambios de autenticación sin depender directamente del contexto)
   ----------------------------------------------------------------- */
const subscribers = new Set(); // Set<(user:any) => void>

export const subscribeAuth = cb => {
  if (typeof cb !== "function") {
    console.warn("[authService] subscribeAuth expects a function");
    return () => {};
  }
  subscribers.add(cb);
  // devolver la función de “unsubscribe”
  return () => subscribers.delete(cb);
};

export const emitAuth = user => {
  // Llamamos a todos los suscriptores de forma segura
  subscribers.forEach(cb => {
    try {
      cb(user);
    } catch (e) {
      console.error("[authService] subscriber threw an error:", e);
    }
  });
};

/* -----------------------------------------------------------------
   Export por defecto (opcional, para usar como objeto único)
   ----------------------------------------------------------------- */
export default {
  setlogoutHandler,
  clearlogoutHandler,
  dologout,
  setLoginHandler,
  clearLoginHandler,
  doLogin,
  subscribeAuth,
  emitAuth,
};

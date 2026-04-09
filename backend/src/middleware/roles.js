/**
 * ---------------------------------------------------------------
 * Middleware de Roles y Permisos
 * ---------------------------------------------------------------
 *
 * En todo el proyecto se usan los siguientes helpers:
 *
 *   • requireRoles([...])          → solo usuarios con esos roles pueden pasar.
 *   • requireAdmin                → atajo para ["admin"].
 *   • requireAdminOrTechnician    → atajo para ["admin","technician"].
 *   • canAccessHotel(hotelId, user)         → true si el usuario puede ver / modificar ese hotel.
 *   • canCreateSuggestions(user)            → true si el usuario tiene permiso para crear Propuestas.
 *   • canViewAllSuggestions(user)          → true si el usuario puede listar todas las Propuestas.
 *   • canManageTickets(user)                → true si el usuario puede crear/editar/tomar tickets.
 *
 * Los valores de los roles están centralizados en `src/utils/constants.js`
 * (UserRoles.ADMIN, UserRoles.TECHNICIAN, UserRoles.HOTEL_USER,
 *  UserRoles.CENTRAL_USER, etc.).
 *
 * Cada función devuelve **un middleware** (para los `require*`) o un
 * **boolean** (para los `can*`) que se pueden usar tanto en los routers
 * como dentro de la lógica del modelo.
 * ---------------------------------------------------------------
 */

const { UserRoles } = require('../utils/constants');

/**
 * Middleware que exige que el usuario autenticado posea **alguno** de los
 * roles indicados en el array `allowedRoles`.
 *
 * @param {string[]} allowedRoles  - Lista de roles que pueden acceder.
 * @returns {(req,res,next)=>void}
 */
function requireRoles(allowedRoles) {
  return (req, res, next) => {
    // Si el JWT no fue validado previamente, `req.user` no existirá.
    if (!req.user) {
      return res.status(401).json({ detail: 'No autenticado' });
    }

    const userRole = req.user.role;

    // Los roles están guardados como cadena (p.ej. "admin").
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ detail: 'Permisos insuficientes' });
    }

    next();
  };
}

/* -----------------------------------------------------------------
 * Atajos de uso frecuente (para evitar escribir el array completo)
 * ----------------------------------------------------------------- */
const requireAdmin = requireRoles([UserRoles.ADMIN]);

const requireAdminOrTechnician = requireRoles([
  UserRoles.ADMIN,
  UserRoles.TECHNICIAN,
]);

/* -----------------------------------------------------------------
 * Funciones auxiliares – devuelven booleanos y pueden usarse en
 * lógica de negocio (modelos, servicios, controladores, etc.).
 * ----------------------------------------------------------------- */

/**
 * ¿Puede el usuario acceder al hotel con id `hotelId`?
 *  - ADMIN y TECHNICIAN tienen acceso a **cualquier** hotel.
 *  - HOTEL_USER sólo a los hoteles listados en `user.hotel_ids`.
 *  - Otros roles → false.
 */
function canAccessHotel(hotelId, user) {
  if (!user) return false;

  if (user.role === UserRoles.ADMIN || user.role === UserRoles.TECHNICIAN) {
    return true;
  }

  if (user.role === UserRoles.HOTEL_USER) {
    // `hotel_ids` suele estar guardado como array (p.ej. [1,2,3]).
    return Array.isArray(user.hotel_id) && user.hotel_id.includes(hotelId);
  }

  return false;
}

/**
 * ¿Puede el usuario crear una Propuesta?
 *  - ADMIN y TECHNICIAN siempre pueden.
 *  - Hotel / central users solo si `can_create_suggestions` está activado.
 */
function canCreateSuggestions(user) {
  if (!user) return false;

  if (user.role === UserRoles.ADMIN || user.role === UserRoles.TECHNICIAN) {
    return true;
  }

  return !!user.can_create_suggestions;
}

/**
 * ¿Puede el usuario ver **todas** las Propuestas?
 * (En la UI esto habilita la vista de tabla + los filtros avanzados.)
 */
function canViewAllSuggestions(user) {
  if (!user) return false;
  return user.role === UserRoles.ADMIN || user.role === UserRoles.TECHNICIAN;
}

/**
 * ¿Puede el usuario gestionar tickets (crear, asignar, tomar, cambiar estado…)?
 */
function canManageTickets(user) {
  if (!user) return false;
  return user.role === UserRoles.ADMIN || user.role === UserRoles.TECHNICIAN;
}

/* -----------------------------------------------------------------
 * Exportamos todo lo que pueda ser útil en routers o servicios.
 * ----------------------------------------------------------------- */
module.exports = {
  requireRoles,
  requireAdmin,
  requireAdminOrTechnician,
  canAccessHotel,
  canCreateSuggestions,
  canViewAllSuggestions,
  canManageTickets,
};

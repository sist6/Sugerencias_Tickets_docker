// src/models/User.js
/**
 * Modelo de Usuario
 *
 *  • Todos los métodos que necesitan los routers están implementados.
 *  • La relación con hoteles se gestiona con la tabla intermedia `user_hotels`.
 *  • La relación con proyectos visibles se gestiona con la tabla intermedia `project_users`.
 */

const bcrypt = require('bcryptjs');
const { executeQuery } = require('../config/db');
const { generateId, formatDateForSQL } = require('../utils/helpers');
const { Central_ID } = require('../utils/constants'); // <-- Central_ID es el GUID del hotel "Central"

class User {
  /* --------------------------------------------------------------
     BÚSQUEDA
     -------------------------------------------------------------- */

  /** Busca un usuario por email (usado en login / seed). */
  static async findByEmail(email) {
    const result = await executeQuery(
      `SELECT *
         FROM dbo.users
        WHERE email = @email`,
      { email }
    );
    return result.recordset[0] || null;
  }

  /** Busca un usuario por id (usado en /auth/me). */
  static async findById(id) {
    // 1️⃣  Consulta el registro de la tabla users
    const userResult = await executeQuery(
      `SELECT *
         FROM dbo.users
        WHERE id = @id`,
      { id }
    );
    const user = userResult.recordset[0] || null;
    if (!user) return null;

    // 2️⃣  Obtiene los hoteles asociados desde la tabla user_hotels
    const hotelsResult = await executeQuery(
      `SELECT hotel_id
         FROM user_hotels
        WHERE user_id = @id`,
      { id }
    );
    user.hotel_ids = hotelsResult.recordset.map(r => r.hotel_id);

    // 3️⃣  Obtiene los proyectos visibles desde la tabla project_users
    const projResult = await executeQuery(
      `SELECT project_id
         FROM project_users
        WHERE user_id = @id`,
      { id }
    );
    user.project_ids = projResult.recordset.map(r => r.project_id);

    return user;
  }

  /** Lista todos los usuarios (GET /users). */
  static async findAll() {
    // 1️⃣  Usuarios
    const usersResult = await executeQuery(
      `SELECT *
         FROM dbo.users
         ORDER BY name`,
      {}
    );
    const users = usersResult.recordset;
    if (users.length === 0) return users;

    // 2️⃣  Hoteles asociados (una única consulta para todos)
    const userIds = users.map(u => u.id);
    const params = {};
    const inList = userIds
      .map((_, i) => {
        params[`id${i}`] = userIds[i];
        return `@id${i}`;
      })
      .join(',');

    const hotelsResult = await executeQuery(
      `SELECT user_id, hotel_id
         FROM user_hotels
        WHERE user_id IN (${inList})`,
      params
    );

    // 3️⃣  Proyectos visibles (una única consulta para todos)
    const projectsResult = await executeQuery(
      `SELECT user_id, project_id
         FROM project_users
        WHERE user_id IN (${inList})`,
      params
    );

    // 4️⃣  Agrupamos por user_id
    const hotelsByUser = {};
    hotelsResult.recordset.forEach(row => {
      if (!hotelsByUser[row.user_id]) hotelsByUser[row.user_id] = [];
      hotelsByUser[row.user_id].push(row.hotel_id);
    });

    const projectsByUser = {};
    projectsResult.recordset.forEach(row => {
      if (!projectsByUser[row.user_id]) projectsByUser[row.user_id] = [];
      projectsByUser[row.user_id].push(row.project_id);
    });

    // 5️⃣  Añadimos las propiedades
    users.forEach(u => {
      u.hotel_ids = hotelsByUser[u.id] || [];
      u.project_ids = projectsByUser[u.id] || [];
    });

    return users;
  }

  /* --------------------------------------------------------------
     CREACIÓN
     -------------------------------------------------------------- */
  /**
   * Crea un nuevo usuario.
   *
   * @param {Object} data  {
   *   email,
   *   password,
   *   name,
   *   role = 'central_user',
   *   department_id = null,
   *   can_create_suggestions = false,
   *   can_access_tickets = true,
   *   is_active = true,
   *   microsoft_id = null,
   *   hotel_ids = [],               // opcional, array de ids de hotel
   *   project_ids = []              // opcional, proyectos que podrá ver (si puede crear sugerencias)
   * }
   * @returns {Object} el usuario recién creado (sin password_hash)
   */
  static async createUser({
    email,
    password,
    name,
    role = 'central_user',
    department_id = null,
    can_create_suggestions = false,
    can_access_tickets = true,
    is_active = true,
    microsoft_id = null,
    telf=null,
    hotel_ids = [],               // <-- ahora se guarda en user_hotels
    project_ids = [],            // <-- ahora se guarda en project_users
  }) {
    const id = generateId();
    const passwordHash = await bcrypt.hash(password, 10);
    const now = formatDateForSQL();

    // 1️⃣ Insertamos el registro en la tabla users
    await executeQuery(
      `INSERT INTO dbo.users (
         id,
         email,
         password_hash,
         name,
         role,
         department_id,
         can_create_suggestions,
         can_access_tickets,
         is_active,
         microsoft_id,
         telf,
         created_at,
         updated_at
       ) VALUES (
         @id,
         @email,
         @password_hash,
         @name,
         @role,
         @department_id,
         @can_create_suggestions,
         @can_access_tickets,
         @is_active,
         @microsoft_id,
         @telf,
         @now,
         @now
       )`,
      {
        id,
        email,
        password_hash: passwordHash,
        name,
        role,
        department_id,
        can_create_suggestions: can_create_suggestions ? 1 : 0,
        can_access_tickets: can_access_tickets ? 1 : 0,
        is_active: is_active ? 1 : 0,
        microsoft_id,
        telf,
        now,
      }
    );

    // ----------------------------------------------
    // 2️⃣ Inserción de hoteles (user_hotels)
    //    - Si el rol es central_user asignamos siempre el hotel "Central"
    //    - Si la lista (final) está vacía no hacemos nada
    // ----------------------------------------------
    const finalHotelIds = role === 'central_user' ? [Central_ID] : hotel_ids;

    if (Array.isArray(finalHotelIds) && finalHotelIds.length > 0) {
      const values = finalHotelIds
        .map((_, i) => `(@userId, @hotel${i})`)
        .join(', ');
      const hotelParams = { userId: id };
      finalHotelIds.forEach((hid, i) => (hotelParams[`hotel${i}`] = hid));

      await executeQuery(
        `INSERT INTO user_hotels (user_id, hotel_id) VALUES ${values}`,
        hotelParams
      );
    }

    // 3️⃣  Si el cliente envía una lista de proyectos visibles, los insertamos en project_users
    if (Array.isArray(project_ids) && project_ids.length > 0) {
      const values = project_ids
        .map((_, i) => `(@userId, @proj${i})`)
        .join(', ');
      const projParams = { userId: id };
      project_ids.forEach((pid, i) => (projParams[`proj${i}`] = pid));

      await executeQuery(
        `INSERT INTO project_users (user_id, project_id) VALUES ${values}`,
        projParams
      );
    }

    // 4️⃣  Devolvemos el registro completo (incluyendo hotel_ids y project_ids)
    const created = await User.findById(id);
    return created;
  }

  /* --------------------------------------------------------------
     ACTUALIZACIÓN
     -------------------------------------------------------------- */
  /**
   * Actualiza un usuario.
   *
   * Sólo actualiza los campos que aparecen en `data`.
   * Si se envía `hotel_ids` (array) la tabla user_hotels se reemplaza
   * completamente con esa lista.
   * Si se envía `project_ids` (array) la tabla project_users se reemplaza
   * completamente con esa lista.
   *
   * @param {string} id  id del usuario
   * @param {Object} data  campos a actualizar
   * @returns {Object|null}
   */
  static async updateUser(id, data) {
    const set = [];
    const params = { id };

    // ---------- Campos simples ----------
    if (data.email !== undefined) {
      set.push('email = @email');
      params.email = data.email;
    }
    if (data.name !== undefined) {
      set.push('name = @name');
      params.name = data.name;
    }
    if (data.role !== undefined) {
      set.push('role = @role');
      params.role = data.role;
    }
    if (data.department_id !== undefined) {
      set.push('department_id = @department_id');
      params.department_id = data.department_id;
    }
    if (data.can_create_suggestions !== undefined) {
      set.push('can_create_suggestions = @can_create_suggestions');
      params.can_create_suggestions = data.can_create_suggestions ? 1 : 0;
    }
    if (data.can_access_tickets !== undefined) {
      set.push('can_access_tickets = @can_access_tickets');
      params.can_access_tickets = data.can_access_tickets ? 1 : 0;
    }
    if (data.is_active !== undefined) {
      set.push('is_active = @is_active');
      params.is_active = data.is_active ? 1 : 0;
    }
    if (data.microsoft_id !== undefined) {
      set.push('microsoft_id = @microsoft_id');
      params.microsoft_id = data.microsoft_id;
    }
    if(data.telf !== undefined){
      set.push('telf=@telf');
      params.telf=data.telf;
    }

    // ---------- Cambio de password ----------
    if (data.password !== undefined) {
      const hash = await bcrypt.hash(data.password, 10);
      set.push('password_hash = @password_hash');
      params.password_hash = hash;
    }

    // Si no hay nada que actualizar en la tabla users, saltamos el UPDATE
    if (set.length > 0) {
      set.push('updated_at = @now');
      params.now = formatDateForSQL();

      await executeQuery(
        `UPDATE dbo.users SET ${set.join(', ')} WHERE id = @id`,
        params
      );
    }

    // ---------- Hotel_ids (relación many‑to‑many) ----------
    if (data.hotel_ids !== undefined) {
      // 0️⃣  Borramos los cruces actuales (siempre, incluso si la lista está vacía)
      await executeQuery(`DELETE FROM user_hotels WHERE user_id = @id`, { id });

      // 1️⃣  Determinamos la lista final a insertar
      //      - Si el rol actualizado o el rol actual del usuario es "central_user"
      //        fuerza la asignación del hotel Central.
      let finalHotelIds = data.hotel_ids;
      const userNow = await User.findById(id); // para saber el rol actual
      if (data.role === 'central_user' || userNow.role === 'central_user') {
        finalHotelIds = [Central_ID];
      }

      // 2️⃣  Insertamos la nueva lista (si la hay)
      if (Array.isArray(finalHotelIds) && finalHotelIds.length > 0) {
        const values = finalHotelIds
          .map((_, i) => `(@userId, @hotel${i})`)
          .join(', ');
        const hotelParams = { userId: id };
        finalHotelIds.forEach((hid, i) => (hotelParams[`hotel${i}`] = hid));

        await executeQuery(
          `INSERT INTO user_hotels (user_id, hotel_id) VALUES ${values}`,
          hotelParams
        );
      }
    }

    // ---------- Project_ids (relación many‑to‑many) ----------
    if (data.project_ids !== undefined) {
      // 1) Borramos los cruces actuales
      await executeQuery(`DELETE FROM project_users WHERE user_id = @id`, { id });

      // 2) Si viene una nueva lista, la insertamos
      if (Array.isArray(data.project_ids) && data.project_ids.length > 0) {
        const values = data.project_ids
          .map((_, i) => `(@userId, @proj${i})`)
          .join(', ');
        const projParams = { userId: id };
        data.project_ids.forEach((pid, i) => (projParams[`proj${i}`] = pid));

        await executeQuery(
          `INSERT INTO project_users (user_id, project_id) VALUES ${values}`,
          projParams
        );
      }
    }

    // Devolvemos el usuario actualizado (incluye hotel_ids y project_ids)
    return User.findById(id);
  }

  /* --------------------------------------------------------------
     BORRADO
     -------------------------------------------------------------- */
  static async deleteUser(id) {
    // Primero eliminamos los cruces en las tablas intermedias
    await executeQuery(`DELETE FROM user_hotels WHERE user_id = @id`, { id });
    await executeQuery(`DELETE FROM project_users WHERE user_id = @id`, { id });

    // Después borramos el registro de la tabla users
    await executeQuery(`DELETE FROM dbo.users WHERE id = @id`, { id });
  }

  /* --------------------------------------------------------------
     DATOS DE PRUEBA (seed)
     -------------------------------------------------------------- */
  static async initTestData() {
    try {
      // ---------- ADMIN ----------
      const adminEmail = 'admin@sohohoteles.com';
      const adminExists = await User.findByEmail(adminEmail);
      if (!adminExists) {
        await User.createUser({
          email: adminEmail,
          password: 'admin123',
          name: 'Administrador Sistema',
          role: 'admin',
          can_create_suggestions: true,
          can_access_tickets: true,
          is_active: true,
          hotel_ids: [], // <-- ahora no falla
        });
        console.log('🔹 Usuario ADMIN creado');
      }

      // ---------- TÉCNICO ----------
      const techEmail = 'tecnico@sohohoteles.com';
      if (!(await User.findByEmail(techEmail))) {
        await User.createUser({
          email: techEmail,
          password: 'tecnico123',
          name: 'Técnico Sistema',
          role: 'technician',
          can_create_suggestions: true,
          hotel_ids: [],
        });
        console.log('🔹 Usuario TECH creado');
      }

      // ---------- USUARIO CENTRAL ----------
      const centralEmail = 'central@sohohoteles.com';
      if (!(await User.findByEmail(centralEmail))) {
        await User.createUser({
          email: centralEmail,
          password: 'central123',
          name: 'Usuario Central',
          role: 'central_user',
          can_create_suggestions: false,
          can_access_tickets: true,
          hotel_ids: [],
        });
        console.log('🔹 Usuario CENTRAL creado');
      }
    } catch (err) {
      // Si el error es por duplicado (código 2627) lo ignoramos con warning.
      if (
        err &&
        err.originalError &&
        err.originalError.info &&
        err.originalError.info.number === 2627
      ) {
        console.warn(
          '⚠️  Duplicado detectado al cargar datos de prueba – se ignora.'
        );
      } else {
        console.error('❌ Error en initTestData():', err);
        throw err;
      }
    }
  }
}

/* ------------------------------------------------------------------
   Exportamos la clase completa (con los métodos CRUD añadidos)
   ------------------------------------------------------------------ */
module.exports = User;

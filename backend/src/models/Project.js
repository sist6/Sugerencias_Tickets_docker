/**
 * Modelo de Proyecto
 *
 * • Tabla principal: `projects`
 * • Relaciones many‑to‑many:
 *     – `project_departments`  (departamento ↔︎ proyecto)
 *     – `project_users`        (usuario ↔︎ proyecto)   ← usuarios asignados directamente
 *   (Los usuarios pertenecen a departamentos a través del campo `department_id` en la tabla `users`.)
 * • Incluye:
 *     – CRUD (findAll / findById / create / update / delete)
 *     – Asignación mixta de usuarios y departamentos
 *     – Notificaciones a los usuarios que obtienen acceso
 *     – Lógica de permisos (admin / technician pueden ver todo,
 *       hotel_user solo si es creador, está asignado o pertenece a un
 *       departamento asignado al proyecto)
 *
 * Requisitos de la BD (SQL Server) que ya existen en `schema.txt`:
 *   - `project_departments`
 *   - `project_users`
 *   - `users.department_id` (FK → `departments.id`)
 */

const { generateId, formatDateForSQL } = require('../utils/helpers');
const { isDBConnected, executeQuery } = require('../config/db');
const {
  ProjectStatus,
  UserRoles,
  NotificationType,
} = require('../utils/constants');
const Notification = require('./Notification');

/* -----------------------------------------------------------------
   MEMORIA (para tests / modo sin BD)
   ----------------------------------------------------------------- */
const memoryStore = new Map();

/* -----------------------------------------------------------------
   HELPERS COMUNES
   ----------------------------------------------------------------- */

/**
 * Obtiene los IDs de usuarios que pertenecen a los departamentos indicados.
 * En modo DB ejecuta una única consulta; en modo memoria devuelve [] (no
 * disponemos de los usuarios en memoria).
 */
async function getUserIdsFromDepartmentIds(departmentIds) {
  if (!departmentIds?.length) return [];

  if (isDBConnected()) {
    const placeholders = departmentIds
      .map((_, i) => `@dept${i}`)
      .join(', ');
    const params = {};
    departmentIds.forEach((id, i) => (params[`dept${i}`] = id));

    const result = await executeQuery(
      `SELECT id FROM dbo.users WHERE department_id IN (${placeholders})`,
      params
    );
    return result.recordset.map((r) => r.id);
  }

  // MODO MEMORIA: no disponemos de la tabla de usuarios
  return [];
}

/**
 * Envía la notificación `PROJECT_ASSIGNED` a un conjunto de usuarios.
 */
async function notifyAssignedUsers(projectName, userIds) {
  if (!userIds?.length) return;
  try {
    await Promise.all(
      userIds.map((uid) =>
        Notification.create({
          user_id: uid,
          title: 'Proyecto asignado',
          message: `Has sido asignado al proyecto "${projectName}".`,
          type: NotificationType.PROJECT_ASSIGNED,
          link: `/projects/${projectName}`, // será reemplazado por el id real en el caller
        })
      )
    );
  } catch (nErr) {
    console.error('⚠️  Error enviando notificaciones de asignación de proyecto:', nErr);
  }
}

/* -----------------------------------------------------------------
   BUSCAR POR ID (con opción includeDeleted – no usado aquí)
   ----------------------------------------------------------------- */
async function findById(id, user) {
  if (!user) throw new Error('User object required');

  if (isDBConnected()) {
    const result = await executeQuery(
      `
      SELECT
        p.*,
        (
          SELECT department_id
          FROM dbo.project_departments pd
          WHERE pd.project_id = p.id
          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS department_ids_json
      FROM projects p
      WHERE p.id = @id
      `,
      { id }
    );

    const row = result.recordset[0];
    if (!row) return null;

    // ---- PARSE DE DEPARTAMENTOS ----
    try {
      const parsed = JSON.parse(row.department_ids_json);
      row.department_ids = Array.isArray(parsed)
        ? parsed.map((d) => d.department_id)
        : [];
    } catch (_) {
      row.department_ids = [];
    }
    delete row.department_ids_json;

    // -------------------------------------------------
    //  PERMISOS DE VISUALIZACIÓN
    // -------------------------------------------------
    const canView =
      user.role === UserRoles.ADMIN ||
      user.role === UserRoles.TECHNICIAN ||
      row.created_by === (user.sub || user.id) ||
      (row.user_ids && row.user_ids.includes(user.sub || user.id)) ||
      (row.department_ids && row.department_ids.includes(user.department_id));

    if (!canView) return null;

    // Normalizamos siempre a arrays
    row.user_ids = row.user_ids ?? [];
    row.department_ids = row.department_ids ?? [];

    return row;
  }

  /* ------------------- MODO MEMORIA ------------------- */
  const proj = memoryStore.get(id);
  if (!proj) return null;

  // permisos en memoria (misma lógica que arriba)
  const canView =
    user.role === UserRoles.ADMIN ||
    user.role === UserRoles.TECHNICIAN ||
    proj.created_by === (user.sub || user.id) ||
    (proj.user_ids && proj.user_ids.includes(user.sub || user.id)) ||
    (proj.department_ids && proj.department_ids.includes(user.department_id));

  if (!canView) return null;

  proj.user_ids = proj.user_ids ?? [];
  proj.department_ids = proj.department_ids ?? [];
  return proj;
}

/* -----------------------------------------------------------------
   BUSCAR TODOS LOS PROYECTOS (con filtros y control de permisos)
   ----------------------------------------------------------------- */
async function findAll(filters = {}, user) {
  if (!user) throw new Error('User object required');

  const {
    status,
    created_by,
    // (otros filtros pueden agregarse aquí)
  } = filters;

  const role = user.role || 'admin';

  if (isDBConnected()) {
    const where = [];
    const params = {};

    // -------------------------------------------------
    //  FILTRADO POR ROL
    // -------------------------------------------------
    if (role === UserRoles.HOTEL_USER) {
      where.push(`
        (p.created_by = @userId
         OR p.id IN (
           SELECT pu.project_id
           FROM project_users pu
           WHERE pu.user_id = @userId
         ))
      `);
      params.userId = user.sub;
    } else if (role === UserRoles.CENTRAL_USER) {
      where.push('p.created_by = @userId');
      params.userId = user.sub;
    }
    // admin / technician → sin restricción extra

    // -------------------------------------------------
    //  FILTROS EXPLÍCITOS
    // -------------------------------------------------
    if (status) {
      where.push('p.status = @status');
      params.status = status;
    }
    if (created_by) {
      where.push('p.created_by = @created_by');
      params.created_by = created_by;
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT
        p.*,
        (
          SELECT department_id
          FROM dbo.project_departments pd
          WHERE pd.project_id = p.id
          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS department_ids_json
      FROM projects p
      ${whereClause}
      ORDER BY p.created_at DESC
    `;

    const result = await executeQuery(sql, params);

    // ---- PARSE DE DEPARTAMENTOS ----
    return result.recordset.map((row) => {
      try {
        const parsed = JSON.parse(row.department_ids_json);
        row.department_ids = Array.isArray(parsed)
          ? parsed.map((d) => d.department_id)
          : [];
      } catch (_) {
        row.department_ids = [];
      }
      delete row.department_ids_json;

      // Normalizamos siempre a arrays
      row.user_ids = row.user_ids ?? [];
      row.department_ids = row.department_ids ?? [];

      return row;
    });
  }

  /* ------------------- MODO MEMORIA ------------------- */
  let projects = Array.from(memoryStore.values());

  // ---- RESTRICCIÓN POR ROL ----
  if (role === UserRoles.HOTEL_USER) {
    projects = projects.filter(
      (p) =>
        p.created_by === user.sub ||
        (p.user_ids && p.user_ids.includes(user.sub))
    );
  } else if (role === UserRoles.CENTRAL_USER) {
    projects = projects.filter((p) => p.created_by === (user.sub || user.id));
  }

  // ---- FILTROS EXPLÍCITOS ----
  if (status) projects = projects.filter((p) => p.status === status);
  if (created_by) projects = projects.filter((p) => p.created_by == created_by);

  // orden descendente por fecha de creación (igual que en BD)
  projects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return projects;
}

/* -----------------------------------------------------------------
   CREAR PROYECTO (incluye inserción de usuarios y departamentos)
   ----------------------------------------------------------------- */
async function create(data, creatorId) {
  if (!data.name) {
    throw new Error('El nombre del proyecto es requerido');
  }

  const proj = {
    id: generateId(),
    name: data.name,
    description: data.description || '',
    version: data.version || '1.0.0',
    status: data.status || ProjectStatus.IN_DEVELOPMENT,
    created_by: creatorId,
    suggestion_id: data.suggestion_id || null,
    published_at: null,
    created_at: formatDateForSQL(),
    updated_at: formatDateForSQL(),
  };

  if (isDBConnected()) {
    try {
      /* -------------------------------------------------
         1️⃣  Insertar el registro del proyecto
         ------------------------------------------------- */
      await executeQuery(
        `
        INSERT INTO projects (
          id, name, description, version, status,
          created_by, suggestion_id, published_at,
          created_at, updated_at
        ) VALUES (
          @id, @name, @description, @version, @status,
          @created_by, @suggestion_id, @published_at,
          @created_at, @updated_at
        )
        `,
        proj
      );

      /* -------------------------------------------------
         2️⃣  ASIGNAR USUARIOS INDIVIDUALES (tabla project_users)
         ------------------------------------------------- */
      const directUserIds = Array.isArray(data.user_ids) ? data.user_ids : [];
      if (directUserIds.length > 0) {
        const values = directUserIds
          .map((_, i) => `(@projectId, @user${i}, GETUTCDATE())`)
          .join(', ');
        const params = { projectId: proj.id };
        directUserIds.forEach((uid, i) => (params[`user${i}`] = uid));
        await executeQuery(
          `INSERT INTO project_users (project_id, user_id, created_at) VALUES ${values}`,
          params
        );
      }

      /* -------------------------------------------------
         3️⃣  ASIGNAR DEPARTAMENTOS (tabla project_departments)
         ------------------------------------------------- */
      const departmentIds = Array.isArray(data.department_ids) ? data.department_ids : [];
      if (departmentIds.length > 0) {
        const values = departmentIds
          .map((_, i) => `(@projectId, @dept${i}, GETUTCDATE())`)
          .join(', ');
        const params = { projectId: proj.id };
        departmentIds.forEach((did, i) => (params[`dept${i}`] = did));
        await executeQuery(
          `INSERT INTO project_departments (project_id, department_id, created_at) VALUES ${values}`,
          params
        );
      }

      /* -------------------------------------------------
         4️⃣  NOTIFICACIONES a usuarios (directos + de los departamentos)
         ------------------------------------------------- */
      // 4a) usuarios directos
      if (directUserIds.length > 0) {
        await notifyAssignedUsers(proj.name, directUserIds);
      }

      // 4b) usuarios pertenecientes a los departamentos asignados
      if (departmentIds.length > 0) {
        const deptUserIds = await getUserIdsFromDepartmentIds(departmentIds);
        // Evitar enviar dos veces a usuarios que ya fueron notificados como directos
        const toNotify = deptUserIds.filter((uid) => !directUserIds.includes(uid));
        await notifyAssignedUsers(proj.name, toNotify);
      }

      /* -------------------------------------------------
         5️⃣  NOTIFICACIÓN a admin / tech (nuevo proyecto)
         ------------------------------------------------- */
      try {
        const adminTechRes = await executeQuery(
          `SELECT id FROM dbo.users WHERE role IN ('admin','technician')`,
          {}
        );
        const adminTechIds = (adminTechRes.recordset || []).map((u) => u.id);
        if (adminTechIds.length) {
          await Promise.all(
            adminTechIds.map((uid) =>
              Notification.create({
                user_id: uid,
                title: 'Nuevo proyecto creado',
                message: `Se ha creado el proyecto "${proj.name}".`,
                type: NotificationType.PROJECT_NEW,
                link: `/projects/${proj.id}`,
              })
            )
          );
        }
      } catch (nErr) {
        console.error('⚠️  Error enviando notificaciones de nuevo proyecto:', nErr);
      }

      return proj;
    } catch (dbError) {
      throw new Error(`Error de base de datos: ${dbError.message}`);
    }
  }

  /* ------------------- MODO MEMORIA ------------------- */
  const projMem = {
    ...proj,
    user_ids: Array.isArray(data.user_ids) ? data.user_ids : [],
    department_ids: Array.isArray(data.department_ids)
      ? data.department_ids
      : [],
  };
  memoryStore.set(proj.id, projMem);
  return projMem;
}

/* -----------------------------------------------------------------
   ACTUALIZAR PROYECTO (mantiene lógica de departamentos)
   ----------------------------------------------------------------- */
async function update(id, data, user) {
  // Guardamos el proyecto actual para comparar cambios
  const curProject = await findById(id, user);
  if (!curProject) throw new Error('Proyecto no encontrado');

  // -------------------------------------------------
  // 1️⃣  ACTUALIZAR CAMPOS GENERALES
  // -------------------------------------------------
  if (isDBConnected()) {
    const set = [];
    const params = { id };

    if (data.name !== undefined) {
      set.push('name = @name');
      params.name = data.name;
    }
    if (data.description !== undefined) {
      set.push('description = @description');
      params.description = data.description;
    }
    if (data.version !== undefined) {
      set.push('version = @version');
      params.version = data.version;
    }
    if (data.status !== undefined) {
      set.push('status = @status');
      params.status = data.status;
    }
    if (data.suggestion_id !== undefined) {
      set.push('suggestion_id = @suggestion_id');
      params.suggestion_id = data.suggestion_id;
    }
    if (data.published_at !== undefined) {
      set.push('published_at = @published_at');
      params.published_at = data.published_at;
    }

    if (set.length > 0) {
      set.push('updated_at = @updated_at');
      params.updated_at = formatDateForSQL();
      await executeQuery(`UPDATE projects SET ${set.join(', ')} WHERE id = @id`, params);
    }
  } else {
    const proj = memoryStore.get(id);
    if (proj) {
      if (data.name !== undefined) proj.name = data.name;
      if (data.description !== undefined) proj.description = data.description;
      if (data.version !== undefined) proj.version = data.version;
      if (data.status !== undefined) proj.status = data.status;
      if (data.suggestion_id !== undefined) proj.suggestion_id = data.suggestion_id;
      if (data.published_at !== undefined) proj.published_at = data.published_at;
      proj.updated_at = formatDateForSQL();
    }
  }

  // -------------------------------------------------
  // 2️⃣  ASIGNAR USUARIOS DIRECTOS (project_users)
  // -------------------------------------------------
  if (data.user_ids !== undefined) {
    const newDirectIds = Array.isArray(data.user_ids) ? data.user_ids : [];

    if (isDBConnected()) {
      // Obtener IDs actuales
      const curRes = await executeQuery(
        `SELECT user_id FROM dbo.project_users WHERE project_id = @projectId`,
        { projectId: id }
      );
      const curIds = curRes.recordset.map((r) => r.user_id);

      // Determinar eliminados y añadidos
      const toRemove = curIds.filter((uid) => !newDirectIds.includes(uid));
      const toAdd = newDirectIds.filter((uid) => !curIds.includes(uid));

      // Borrar los que ya no están
      if (toRemove.length) {
        const placeholders = toRemove.map((_, i) => `@rem${i}`).join(', ');
        const params = { projectId: id };
        toRemove.forEach((uid, i) => (params[`rem${i}`] = uid));
        await executeQuery(
          `DELETE FROM dbo.project_users WHERE project_id = @projectId AND user_id IN (${placeholders})`,
          params
        );
      }

      // Insertar los nuevos
      if (toAdd.length) {
        const values = toAdd
          .map((_, i) => `(@projectId, @add${i}, GETUTCDATE())`)
          .join(', ');
        const params = { projectId: id };
        toAdd.forEach((uid, i) => (params[`add${i}`] = uid));
        await executeQuery(
          `INSERT INTO dbo.project_users (project_id, user_id, created_at) VALUES ${values}`,
          params
        );
      }

      // Notificar a los usuarios recién añadidos
      if (toAdd.length) {
        await notifyAssignedUsers(curProject.name, toAdd);
      }
    } else {
      // MODO MEMORIA (solo guardamos IDs directos)
      const proj = memoryStore.get(id);
      if (proj) proj.user_ids = newDirectIds;
    }
  }

  // -------------------------------------------------
  // 3️⃣  ASIGNAR DEPARTAMENTOS (project_departments)
  // -------------------------------------------------
  if (data.department_ids !== undefined) {
    const newDeptIds = Array.isArray(data.department_ids) ? data.department_ids : [];

    if (isDBConnected()) {
      // Obtener departamentos actuales
      const curRes = await executeQuery(
        `SELECT department_id FROM dbo.project_departments WHERE project_id = @projectId`,
        { projectId: id }
      );
      const curDeptIds = curRes.recordset.map((r) => r.department_id);

      // Departamentos añadidos y eliminados
      const deptsToAdd = newDeptIds.filter((did) => !curDeptIds.includes(did));
      const deptsToRemove = curDeptIds.filter((did) => !newDeptIds.includes(did));

      // Eliminar relaciones no deseadas
      if (deptsToRemove.length) {
        const placeholders = deptsToRemove.map((_, i) => `@rem${i}`).join(', ');
        const params = { projectId: id };
        deptsToRemove.forEach((did, i) => (params[`rem${i}`] = did));
        await executeQuery(
          `DELETE FROM dbo.project_departments WHERE project_id = @projectId AND department_id IN (${placeholders})`,
          params
        );
      }

      // Insertar nuevos departamentos
      if (deptsToAdd.length) {
        const values = deptsToAdd
          .map((_, i) => `(@projectId, @dept${i}, GETUTCDATE())`)
          .join(', ');
        const params = { projectId: id };
        deptsToAdd.forEach((did, i) => (params[`dept${i}`] = did));
        await executeQuery(
          `INSERT INTO dbo.project_departments (project_id, department_id, created_at) VALUES ${values}`,
          params
        );
      }

      // Notificar a los usuarios pertenecientes a los departamentos recién añadidos
      if (deptsToAdd.length) {
        const deptUserIds = await getUserIdsFromDepartmentIds(deptsToAdd);
        // Evitar duplicar notificaciones a usuarios que ya estaban asignados directamente
        const alreadyDirect = data.user_ids ? data.user_ids : curProject.user_ids;
        const toNotify = deptUserIds.filter((uid) => !alreadyDirect?.includes(uid));
        await notifyAssignedUsers(curProject.name, toNotify);
      }
    } else {
      // MODO MEMORIA – solo guardamos la lista de departamentos
      const proj = memoryStore.get(id);
      if (proj) proj.department_ids = newDeptIds;
    }
  }

  // -------------------------------------------------
  // DEVOLVER PROYECTO ACTUALIZADO (con permisos)
  // -------------------------------------------------
  return findById(id, user);
}

/* -----------------------------------------------------------------
   ASIGNAR DEPARTAMENTO A UN PROYECTO (solo crea la relación)
   ----------------------------------------------------------------- */
async function assignDepartmentAndUsers(projectId, departmentId) {
  if (!projectId || !departmentId) {
    throw new Error('Faltan ids de proyecto o departamento');
  }

  if (!isDBConnected()) {
    // ----------- MODO MEMORIA ------------
    const proj = memoryStore.get(projectId);
    if (!proj) throw new Error('Proyecto no encontrado');

    // 1️⃣  Añadir dept. al proyecto (si no estaba)
    proj.department_ids = proj.department_ids ?? [];
    if (!proj.department_ids.includes(departmentId)) {
      proj.department_ids.push(departmentId);
    }

    // No insertamos usuarios en project_users (evitamos duplicados)

    // Notificar a los usuarios del departamento
    // En modo memoria no disponemos de la tabla de usuarios, se omite.
    return proj;
  }

  // ------------------- VERSIÓN DB -------------------
  const sql = `
    BEGIN TRY
      BEGIN TRANSACTION;

      /* ------------ RELACIÓN proyecto‑departamento ------------ */
      IF NOT EXISTS (
        SELECT 1
        FROM   dbo.project_departments
        WHERE  project_id   = @projectId
          AND  department_id = @departmentId
      )
      BEGIN
        INSERT INTO dbo.project_departments (project_id, department_id, created_at)
        VALUES (@projectId, @departmentId, GETUTCDATE());
      END;

      COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
      IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
      THROW;
    END CATCH;
  `;

  await executeQuery(sql, { projectId, departmentId });

  // Notificar a los usuarios del departamento
  try {
    const deptUserIds = await getUserIdsFromDepartmentIds([departmentId]);
    if (deptUserIds.length) {
      // Necesitamos el nombre del proyecto para la notificación
      const projRes = await executeQuery(
        `SELECT name FROM dbo.projects WHERE id = @projectId`,
        { projectId }
      );
      const projectName = (projRes.recordset[0] && projRes.recordset[0].name) || '';

      await notifyAssignedUsers(projectName, deptUserIds);
    }
  } catch (nErr) {
    console.error('⚠️  Error enviando notificaciones al asignar departamento:', nErr);
  }

  // Devolvemos el proyecto actualizado (contendrá department_ids)
  return findById(projectId);
}

/* -----------------------------------------------------------------
   ELIMINAR DEPARTAMENTO DEL PROYECTO (opcional)
   ----------------------------------------------------------------- */
async function removeDepartment(projectId, departmentId, { alsoRemoveUsers = false } = {}) {
  if (!projectId || !departmentId) {
    throw new Error('Faltan ids de proyecto o departamento');
  }

  if (!isDBConnected()) {
    // ----------- MODO MEMORIA ------------
    const proj = memoryStore.get(projectId);
    if (!proj) throw new Error('Proyecto no encontrado');

    // 1️⃣  Quitar dept. del proyecto
    proj.department_ids = (proj.department_ids ?? []).filter((d) => d !== departmentId);

    // Si también queremos eliminar usuarios que quedaran sin departamentos asociados
    if (alsoRemoveUsers) {
      // No disponemos de la tabla de usuarios en memoria → se omite
    }

    return proj;
  }

  // ------------------- VERSIÓN DB -------------------
  const sql = `
    BEGIN TRY
      BEGIN TRANSACTION;

      /* 1️⃣  Eliminar la fila de project_departments */
      DELETE FROM dbo.project_departments
      WHERE project_id = @projectId AND department_id = @departmentId;

      /* 2️⃣ (Opcional) Eliminar usuarios del dept. si ya no están en otro dept. del proyecto */
      IF @alsoRemoveUsers = 1
      BEGIN
        /* 2a. Obtener IDs de usuarios que pertenecen al dept. que vamos a eliminar */
        DECLARE @usersToCheck TABLE (user_id UNIQUEIDENTIFIER);
        INSERT INTO @usersToCheck (user_id)
        SELECT u.id
        FROM dbo.users u
        WHERE u.department_id = @departmentId;

        /* 2b. Eliminar de project_users sólo si el usuario NO pertenece a ningún otro dept. del proyecto */
        DELETE pu
        FROM dbo.project_users pu
        JOIN @usersToCheck uc ON uc.user_id = pu.user_id
        WHERE pu.project_id = @projectId
          AND NOT EXISTS (
                SELECT 1
                FROM dbo.project_departments pd
                JOIN dbo.users u2 ON u2.department_id = pd.department_id
                WHERE pd.project_id = @projectId
                  AND u2.id = pu.user_id
          );
      END

      COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
      IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
      THROW;
    END CATCH;
  `;

  await executeQuery(sql, {
    projectId,
    departmentId,
    alsoRemoveUsers: alsoRemoveUsers ? 1 : 0,
  });

  return findById(projectId);
}

/* -----------------------------------------------------------------
   BORRAR (soft‑delete NO aplicable a proyectos) –  eliminación definitiva
   ----------------------------------------------------------------- */
async function remove(id) {
  if (isDBConnected()) {
    await executeQuery(`DELETE FROM projects WHERE id = @id`, { id });
  } else {
    memoryStore.delete(id);
  }
}

/* -----------------------------------------------------------------
   EXPORTACIÓN
   ----------------------------------------------------------------- */
module.exports = {
  findAll,
  findById,
  create,
  update,
  delete: remove, // alias `remove`
  assignDepartmentAndUsers,
  removeDepartment,
};

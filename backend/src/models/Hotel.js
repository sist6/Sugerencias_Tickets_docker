// src/models/Hotel.js
/**
 * Modelo para la tabla dbo.hotels
 *
 * Columnas reales en la base:
 *   id (PK, default NEWID())
 *   name        – NOT NULL
 *   code        – NOT NULL, unique, max 20 chars
 *   address     – NULL
 *   is_active   – NULL (default 1)
 *   created_at  – NULL (default GETUTCDATE())
 *   updated_at  – NULL (default GETUTCDATE())
 *
 * El modelo:
 *   – usa sólo los campos existentes.
 *   – genera automáticamente un `code` si no lo recibe.
 *   – permite crear el “Hotel Central” (ID constante) y un “Hotel Demo”
 *     para desarrollo.
 */

const { executeQuery } = require('../config/db');
const { generateId, formatDateForSQL } = require('../utils/helpers');
const { Central_ID } = require('../utils/constants');

/* -----------------------------------------------------------------
   Helpers internos
   ----------------------------------------------------------------- */

/**
 * Genera un código a partir del nombre.
 *   • Normaliza: elimina espacios, convierte a mayúsculas.
 *   • Trunca a 20 caracteres (máximo permitido por la tabla).
 *   • Si el resultado queda vacío se usa un GUID corto.
 */
function makeCodeFromName(name) {
  if (!name) return generateId().split('-')[0].toUpperCase(); // fallback

  const raw = name
    .trim()
    .replace(/\s+/g, '-')        // espacios → guiones
    .replace(/[^A-Z0-9-]/gi, '') // solo alfanuméricos + guiones
    .toUpperCase();

  // Si supera 20 caracteres lo truncamos.
  return raw.length > 20 ? raw.slice(0, 20) : raw;
}

/* -----------------------------------------------------------------
   Clase Hotel
   ----------------------------------------------------------------- */
class Hotel {
  /* --------------------------------------------------------------
     BÚSQUEDA
     -------------------------------------------------------------- */
  static async findById(id) {
    const result = await executeQuery(
      `SELECT *
         FROM dbo.hotels
        WHERE id = @id`,
      { id }
    );
    return result.recordset[0] || null;
  }

  static async findAll() {
    const result = await executeQuery(
      `SELECT *
         FROM dbo.hotels
         ORDER BY name`,
      {}
    );
    return result.recordset;
  }

  /* --------------------------------------------------------------
     CREACIÓN
     -------------------------------------------------------------- */
  /**
   * Inserta un nuevo hotel.
   *
   * @param {Object} data
   *   - id (opcional) : GUID. Si no se pasa se genera uno.
   *   - name          : string (obligatorio)
   *   - address       : string (opcional)
   *   - code          : string (opcional – se genera a partir del name)
   *   - is_active     : boolean (opcional – default true)
   * @returns {Object} el hotel recién creado (incluye timestamps)
   */
  static async createHotel({
    id,
    name,
    address = '',
    code,
    is_active = true,
  }) {
    if (!name) {
      throw new Error('El campo "name" es obligatorio para crear un hotel.');
    }

    const hotelId = id || generateId();
    const now = formatDateForSQL();

    // Si no se envía código lo generamos automáticamente.
    const hotelCode = code ? code : makeCodeFromName(name);

    await executeQuery(
      `INSERT INTO dbo.hotels (
         id,
         name,
         code,
         address,
         is_active,
         created_at,
         updated_at
       ) VALUES (
         @id,
         @name,
         @code,
         @address,
         @isActive,
         @now,
         @now
       )`,
      {
        id: hotelId,
        name,
        code: hotelCode,
        address,
        isActive: is_active ? 1 : 0,
        now,
      }
    );

    // Devolvemos el registro completo (con defaults aplicados por SQL)
    return Hotel.findById(hotelId);
  }

  /* --------------------------------------------------------------
     ACTUALIZACIÓN
     -------------------------------------------------------------- */
  /**
   * Actualiza los datos de un hotel.
   *
   * Sólo se actualizan los campos que vienen en `data`.
   *
   * @param {string} id   – GUID del hotel a modificar
   * @param {Object} data – campos a actualizar (name, address, code, is_active)
   * @returns {Object|null} hotel actualizado o null si no existe
   */
  static async updateHotel(id, data) {
    const existent = await Hotel.findById(id);
    if (!existent) return null;

    const set = [];
    const params = { id };

    if (data.name !== undefined) {
      set.push('name = @name');
      params.name = data.name;
    }
    if (data.address !== undefined) {
      set.push('address = @address');
      params.address = data.address;
    }
    if (data.code !== undefined) {
      set.push('code = @code');
      params.code = data.code;
    }
    if (data.is_active !== undefined) {
      set.push('is_active = @isActive');
      params.isActive = data.is_active ? 1 : 0;
    }

    if (set.length === 0) {
      // nada que cambiar
      return existent;
    }

    set.push('updated_at = @now');
    params.now = formatDateForSQL();

    await executeQuery(
      `UPDATE dbo.hotels SET ${set.join(', ')} WHERE id = @id`,
      params
    );

    return Hotel.findById(id);
  }

  /* --------------------------------------------------------------
     BORRADO
     -------------------------------------------------------------- */
  static async deleteHotel(id) {
    // Primero eliminamos cruces en tablas intermedias (user_hotels, etc.)
    await executeQuery(`DELETE FROM user_hotels WHERE hotel_id = @id`, { id });

    // Luego el registro propio
    await executeQuery(`DELETE FROM dbo.hotels WHERE id = @id`, { id });
  }

  /* --------------------------------------------------------------
     DATOS DE PRUEBA (seed)
     -------------------------------------------------------------- */
  /**
   * Crea (si no existen) el hotel “Central” y un hotel demo.
   *
   * * Central → usa el GUID constante `Central_ID`.  
   * * Demo    → se genera con un GUID aleatorio y con código “DEMO”.
   */
  static async initTestData() {
    try {
      // ---------- 1️⃣  HOTEL CENTRAL ----------
      const centralExists = await executeQuery(
        `SELECT 1 FROM dbo.hotels WHERE id = @id`,
        { id: Central_ID }
      );

      if (!centralExists.recordset.length) {
        await Hotel.createHotel({
          id: Central_ID,
          name: 'Oficina Corporativa',
          address: 'Alameda de Colón, 9, Distrito Centro, 29001 Málaga3',
          code: 'OFC',            // código corto y único
          is_active: true,
        });
        console.log('🔹 Hotel CENTRAL creado (seed)');
      
      }

      // ---------- 2️⃣  HOTEL DEMO ----------
      const demoName = 'SB Colón';
      const demoExists = await executeQuery(
        `SELECT 1 FROM dbo.hotels WHERE name = @name`,
        { name: demoName }
      );

      if (!demoExists.recordset.length) {
        await Hotel.createHotel({
          name: demoName,
          address: 'Alameda de Colón, 5, Distrito Centro, 29001 Málaga',
          code: 'SCL',
          is_active: true,
        });
        console.log('🔹 Hotel DEMO creado (seed)');
      } 
    } catch (err) {
      // Duplicado (código 2627) → solo advertencia, no abortamos.
      if (
        err &&
        err.originalError &&
        err.originalError.info &&
        err.originalError.info.number === 2627
      ) {
        console.warn('⚠️  Duplicado al cargar datos de prueba – se ignora.');
      } else {
        console.error('❌ Error en Hotel.initTestData():', err);
        throw err;
      }
    }
  }
}

/* ------------------------------------------------------------------
   Exportamos la clase completa (con los métodos CRUD añadidos)
   ------------------------------------------------------------------ */
module.exports = Hotel;

#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------
# 1️⃣ Arrancamos SQL Server en background
# ---------------------------------------------------------
/opt/mssql/bin/sqlservr &

# ---------------------------------------------------------
# 2️⃣ Esperamos a que acepte conexiones
# ---------------------------------------------------------
echo "⌛️ Esperando a que SQL Server levante..."
until /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P "$SA_PASSWORD" -Q "SELECT 1" > /dev/null 2>&1; do
  sleep 2
done
echo "✅ SQL Server activo."

# ---------------------------------------------------------
# 3️⃣ Creamos el login y usuario que usará la aplicación
# ---------------------------------------------------------
APP_USER="${DB_USER}"
APP_PASS="${DB_PASSWORD}"
APP_DB="${DB_NAME}"

echo "🔐 Creando login y usuario '${APP_USER}' (si no existen)..."
/opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P "$SA_PASSWORD" -Q "
IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = N'${APP_USER}')
BEGIN
    CREATE LOGIN [${APP_USER}] WITH PASSWORD = N'${APP_PASS}';
END;
GO
USE [${APP_DB}];
IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = N'${APP_USER}')
BEGIN
    CREATE USER [${APP_USER}] FOR LOGIN [${APP_USER}];
    ALTER ROLE db_owner ADD MEMBER [${APP_USER}];   -- Cambia si deseas menos privilegios
END;
GO
"

# ---------------------------------------------------------
# 4️⃣ Ejecutamos los scripts .sql (pueden ser idempotentes)
# ---------------------------------------------------------
echo "📂 Ejecutando scripts de esquema..."
for script in /tmp/db-scripts/*.sql; do
  echo "   - $script"
  /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P "$SA_PASSWORD" -i "$script"
done

# ---------------------------------------------------------
# 5️⃣ (Opcional) Deshabilitamos el login SA por seguridad
# ---------------------------------------------------------
# echo "🔒 Deshabilitando login 'sa'..."
# /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P "$SA_PASSWORD" -Q "ALTER LOGIN sa DISABLE;"

# ---------------------------------------------------------
# 6️⃣ Detenemos el proceso temporal y dejamos que Docker lo relance en foreground
# ---------------------------------------------------------
pkill sqlservr   # elimina el proceso que iniciamos en background
echo "🚀 Iniciando SQL Server en foreground (el proceso principal)..."
exec /opt/mssql/bin/sqlservr

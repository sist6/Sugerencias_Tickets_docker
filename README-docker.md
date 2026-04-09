# 🚀 Dockerización Completa - SUGERENCIAS TICKETS

## 📦 Archivos creados
✅ `docker-compose.yml` - Orquesta DB + Backend + Frontend
✅ `frontend/Dockerfile` + `nginx.conf` - React optimizado
✅ `backend/Dockerfile` - Corregido y optimizado
✅ `.env.example` - Plantilla de variables
✅ `docker-compose.override.yml` - Credenciales por defecto

## 🛠️ Comandos para ejecutar

```bash
# 1. Copiar plantilla de variables (IMPORTANTE)
cp .env.example .env
# Editar .env con tus valores reales

# 2. Crear directorio de persistencia DB
mkdir -p data/mssql

# 3. Levantar todo (primera vez construye imágenes)
docker compose up -d --build

# 4. Ver estado
docker compose ps
docker compose logs -f

# 5. Acceder:
# 🌐 Frontend: http://localhost
# 🖥️  API: http://localhost:4000  
# 🗄️  DB: localhost:1433 (sa / tu_password)

# 6. Seed inicial (admin)
curl -X POST http://localhost:4000/api/seed \\
  -H 'Content-Type: application/json' \\
  -d '{\"email\":\"admin@sohohoteles.com\",\"password\":\"Admin123!\"}'
```

## 🔍 Comandos útiles
```bash
# Parar todo
docker compose down

# Parar y limpiar volúmenes (¡PERDIDA DE DATOS!)
docker compose down -v

# Reconstruir
docker compose build --no-cache

# Logs específicos
docker compose logs backend
docker compose logs db
```

## ⚙️ Variables críticas (.env)
```
DB_SA_PASSWORD=TuContraseñaSegura123!
JWT_SECRET=tu-clave-jwt-super-segura-64-caracteres
```

## ✅ Verificación
```
http://localhost              → Frontend SPA
http://localhost:4000/health  → Backend OK
http://localhost:4000/api/    → API Docs
localhost:1433 (Azure Data Studio) → DB
```

¡Proyecto dockerizado completo! 🎉


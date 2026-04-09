# SOHO Systems Core

Plataforma completa de gestión para tickets, sugerencias y proyectos.

## 🚀 Características Principales

| Módulo | Funcionalidades | Estado |
|--------|-----------------|---------|
| **Dashboard** | Métricas RT, gráficos Recharts | ✅ Listo |
| **Tickets** | CRUD + asignación + WS notifs | ✅ Listo |
| **Sugerencias** | Estados workflow + archivos adjuntos | ✅ Listo |
| **Proyectos** | Versionado + asignaciones dept | ✅ Listo |
|Recursos Sistemas| MapaSoho + Manual Usuario + Reporte de Ticket| ✅ Listo |
| **Admin** | Users/Hotels/Depts + RBAC | ✅ Listo |
| **Notificaciones** | WebSocket real-time | ✅ Activo |

### Roles & Permisos
- **Admin**: Control total
- **Técnico**: Gestión tickets/propuestas/proyectos  
- **Hotel User**: Tickets propios + sugerencias visibles
- **Central User**: Tickets centrales + propuestas

## 🚀 Características

### Roles del Sistema
- **Administrador**: Control total del sistema
- **Técnico**: Gestión de tickets, Propuestas y proyectos
- **Usuario Hotel**: Crear y ver tickets de su hotel
- **Usuario Central**: Crear tickets y Propuestas

### Módulos
1. **Dashboard**: Métricas y estadísticas en tiempo real
2. **Tickets**: Gestión completa de incidencias con estados, prioridades y asignaciones
3. **Propuestas**: Propuestas que pasan por estados (Nuevo → En estudio → En desarrollo → Publicado)
4. **Proyectos**: Control de proyectos con versiones y estados
5. **Administración**: Gestión de usuarios, hoteles, departamentos y tipos de ticket

## 🛠️ Stack Tecnológico (ACTUAL 🚀)

**Frontend:** React 18 + shadcn/ui + TailwindCSS 3.4  
**Backend:** Node.js 18 + Express 4.18 + MSSQL  
**Real-time:** WebSocket autenticado  
**Base datos:** SQL Server (pool optimizado)

**Seguridad:** Helmet CSP + RateLimit + JWT + Roles ✅

## 📁 Estructura del Proyecto

```
/project
├── backend/
│   ├── server.py           # API FastAPI
│   ├── requirements.txt    # Dependencias Python
│   ├── .env               # Variables de entorno
│   └── .env.example       # Plantilla de configuración
│
├── frontend/
│   ├── src/
│   │   ├── components/    # Componentes React
│   │   ├── pages/         # Páginas de la aplicación
│   │   ├── contexts/      # Context API (Auth, Notifications)
│   │   └── lib/           # Utilidades y API client
│   ├── package.json
│   └── .env
│
├── database/
│   └── schema.sql         # Script SQL Server completo
│
└── README.md
```

## 🚀 Instalación Rápida ()

```bash
# Backend (Node.js)
cd backend
npm install
npm run dev   

# Frontend (React) 
cd ../frontend
yarn install
yarn start      
```

**Login de prueba:** `admin@sohohoteles.com` / `admin123`

**Auto-seed:** Primera visita al login → \"Inicializar datos\"

### Inicializar Datos de Prueba

Una vez iniciada la aplicación, visitar la página de login y hacer clic en "Inicializar datos de prueba" o llamar:

```bash
curl -X POST http://192.168.125.52:8001/api/seed
```

Esto creará:
- Usuario admin: `admin@sohohoteles.com` / `admin123`
- Usuario técnico: `tecnico@sohohoteles.com` / `tecnico123`
- Usuario hotel: `recepcion@sohohoteles.com` / `hotel123`
- Hoteles de ejemplo
- Tipos de ticket
- Tickets y Propuestas de ejemplo

## 🔐 Autenticación

### Login Local
- Email y contraseña con JWT

### Microsoft OAuth (preparado)
- Configurar Azure AD con las variables en `.env`
- Solo permite emails `@sohohoteles.com`
- Registro automático con permisos básicos

## 📊 Estados del Sistema

### Estados de Ticket
```
Nuevo → Asignado → En proceso → Esperando respuesta → Resuelto → Cerrado
```

### Estados de Propuesta
```
Nueva → En estudio → En desarrollo → Publicada
                  ↘ Cancelada (con motivo)
```

### Estados de Proyecto
```
En desarrollo → Publicado → Actualización disponible → Archivado
```

## 🎨 UI/UX

- Diseño minimalista en blanco y negro
- Dashboard moderno y funcional
- Responsive para móviles y tablets
- Sistema de notificaciones con campana
- Toasts para feedback de acciones

## 🔧 Configuración para Producción (SQL Server)

1. Crear base de datos en SQL Server
2. Ejecutar `database/schema.sql`
3. Configurar variables en `.env`:
```env
SQLSERVER_HOST=192.168.125.52
SQLSERVER_PORT=1433
SQLSERVER_DATABASE=SOHOSystemsCore
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=YourPassword123!
```

4. Modificar la conexión de base de datos en el backend

## 📝 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Usuario actual
- `POST /api/auth/microsoft` - OAuth Microsoft

### Tickets
- `GET /api/tickets` - Listar tickets
- `POST /api/tickets` - Crear ticket
- `GET /api/tickets/{id}` - Detalle de ticket
- `PUT /api/tickets/{id}` - Actualizar ticket
- `POST /api/tickets/{id}/reopen` - Reabrir ticket
- `POST /api/tickets/{id}/comments` - Añadir comentario
- `POST /api/tickets/{id}/assign` - Asignar ticket

### Propuestas
- `GET /api/suggestions` - Listar Propuestas
- `POST /api/suggestions` - Crear Propuesta
- `PUT /api/suggestions/{id}` - Actualizar Propuesta
- `POST /api/suggestions/{id}/take` - Tomar para estudio

### Proyectos
- `GET /api/projects` - Listar proyectos
- `POST /api/projects` - Crear proyecto
- `PUT /api/projects/{id}` - Actualizar proyecto

### Dashboard
- `GET /api/dashboard/stats` - Estadísticas

## 🔒 Seguridad

- JWT para autenticación
- Middleware de roles y permisos
- Validación de formularios
- Sanitización de inputs
- CORS configurado

## 📄 Licencia

Propiedad de SOHO Hoteles - Uso interno

---

Desarrollado por Ayoub El Mesellek Cherif para el Departamento de Sistemas de SOHO Hoteles

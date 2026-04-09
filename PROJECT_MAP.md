# Mapa Completo del Proyecto SUGERENCIAS_TICKETS (SOHO Systems Core v1.0.0)

## 🏗️ Estructura de Directorios (Árbol Completo - Actualizado)

```
SUGERENCIAS_TICKETS-main/
├── README.md - Instalación/auth/features
├── PROJECT_MAP.md - Este archivo
├── TODO.md, AUDITORIA_TECNICA.md, DOCUMENTO_PROYECTO_ANALISIS.md
├── backend_test.py, role_based_test.py
├── backend/
│   ├── package.json (Node 18+, Express 4.18)
│   ├── src/
│   │   ├── server.js - HTTP+WS port 4000, TicketWatcher, global.wss, bot
│   │   ├── app.js - CORS/helmet/routes (/api/* 17 routers)
│   │   ├── middleware/ (auth.js, roles.js, rateLimiter.js, errorHandler.js)
│   │   ├── models/ (11: User, Ticket, Suggestion, Project, Hotel, Dept, Role, etc.)
│   │   ├── routes/ (17: auth.routes.js, users.routes.js, tickets.routes.js, etc.)
│   │   ├── utils/ (wsBroadcaster.js, ticketWatcher.js, hotelsData.js, fuzzy.js)
│   │   ├── bot/telegramBot.js (Telegraf)
│   │   └── config/ (db.js MSSQL, env.js)
├── database/
│   └── schema.sql - SQL Server (13 tables + views/procs/triggers)
├── frontend/
│   ├── package.json (React 18.2, shadcn, Tailwind 3.4)
│   ├── craco.config.js, tailwind.config.js
│   ├── src/
│   │   ├── App.js - React Router (17 pages)
│   │   ├── components/layout/ (DashboardLayout.js, Sidebar.js, TopBar.js)
│   │   ├── components/ui/ (30+ shadcn: button.jsx, table.jsx, dialog.jsx, etc.)
│   │   ├── contexts/ (AuthContext.js, NotificationContext.js, ThemeContext.js)
│   │   ├── lib/ (api.js axios, ws.js, utils.js)
│   │   └── pages/ (DashboardPage.js, TicketsPage.js/Detail, Admin/* 8 pages)
├── test_reports/, tests/, memory/
```

## 🛠️ Stack Tecnológico (Versiones Exactas)

| Capa | Tecnologías Principales |
|------|-------------------------|
| **Backend** | Node.js >=18, Express 4.18.2, mssql 10.0.1 (SQL Server), telegraf 4.16.3 (Telegram), ws 8.20.0, helmet 8.1.0, express-rate-limit 8.3.2, jsonwebtoken 9.0.3 |
| **Frontend** | React 18.2.0, react-router-dom 7.5.1, TailwindCSS 3.4.17, shadcn/ui (Radix), recharts 3.6.0, leaflet 1.9.4 (maps), sonner 2.0.3, react-hook-form 7.56.2, zod 3.24.4 |
| **DB** | SQL Server (schema.sql: 13 tables, views vw_tickets_full/etc., procs sp_get_dashboard_stats, triggers updated_at) |
| **Real-time** | WebSockets (/ws JWT-auth), global.wss broadcaster |
| **Tests** | pytest (backend_test.py), Jest (backend), test_reports JSON |

## 📐 Arquitectura (Mermaid Mejorado)

```mermaid
graph TB
    subgraph FRONTEND ['Frontend React']
        A[App.js Router] --> B[LoginPage]
        A --> C[DashboardLayout + Outlet]
        C --> D[Pages: Dashboard/Tickets/Suggestions/Projects/Admin*]
        D --> E[shadcn UI + recharts/leaflet]
        F[Contexts: Auth/Notifications/Theme] 
        G[lib/api.js axios /api/*]
        H[lib/ws.js -> ws://localhost:4000/ws?token]
    end
    
    subgraph BACKEND ['Backend Express']
        I[server.js HTTP+WS port 4000]
        I --> J[app.js middleware: helmet/CORS/rate/auth/roles]
        J --> K[Routes /api: 17 (tickets/users/suggestions/etc.)]
        K --> L[Models -> MSSQL pool]
        M[utils: wsBroadcaster/ticketWatcher/hotelsData/fuzzy]
        N[bot/telegramBot.js -> userTelegram.service]
        O[global.wss + TicketWatcher polling 5s]
    end
    
    subgraph DB ['SQL Server SOHOSystemsCore']
        P[Tables: users/hotels/tickets/suggestions/projects/...]
        Q[Views: vw_tickets_full/vw_suggestions_full]
        R[Procs: sp_get_dashboard_stats]
    end
    
    FRONTEND -.->|WS realtime| BACKEND
    FRONTEND -->|JWT API calls| BACKEND
    BACKEND -->|Queries| DB
    N -.->|Notifs| O
    
    classDef fe fill:#60a5fa
    classDef be fill:#f59e0b
    classDef db fill:#10b981
    class FRONTEND,BACKEND,DB fe,be,db
```

## 🔌 Backend API Routes (/api prefix)
- auth.routes.js (login/register/me/microsoft)
- users.routes.js, roles.routes.js
- tickets.routes.js, ticketTypes.routes.js, ticketreport.routes.js
- suggestions.routes.js
- projects.routes.js
- hotels.routes.js, maphotels.routes.js
- departments.routes.js
- notifications.routes.js
- attachments.js, dashboard.routes.js, solutionTypes.routes.js, seed.routes.js, internal.routes.js

## 🧭 Frontend Pages/Routes
**Public**: `/login`
**Protected** (DashboardLayout/Sidebar):
- `/` DashboardPage
- `/tickets`, `/tickets/:id`
- `/suggestions`, `/suggestions/:id`
- `/projects`, `/projects/:id`
- Admin: `/admin/users`, `/admin/hotels`, `/admin/departments`, `/admin/roles`, `/admin/ticket-types`, `/admin/ticketsreport`, `/admin/maphotels`, `/admin/solution-type`

## 🗄️ DB Schema Summary (13 Tables)
| Table | Key Fields | Relations |
|-------|------------|-----------|
| users | id, email, role (admin/technician/hotel_user/central_user), dept_id | user_hotels, tickets, etc. |
| hotels | id, name, code | tickets, user_hotels |
| tickets | id, title, status (new/in_progress/resolved/closed), priority, hotel_id, assigned_to | comments, types |
| suggestions | id, status (new/in_study/in_dev/cancelled/published), project_id | projects |
| projects | id, status (in_dev/published/update_avail/archived), suggestion_id | depts/users |
| Others | roles, departments, ticket_types, notifications, attachments/comments | N/A |

Views: vw_tickets_full; Procs: dashboard stats.

## 🚀 Deployment & Run
```
# Backend
cd backend && npm i && npm run dev  # http://localhost:4000 /ws

# Frontend  
cd frontend && yarn i && yarn start # http://localhost:3000

# Seed data
POST /api/seed (creates admin@sohohoteles.com/admin123)
```
**.env**: DB creds (SQLSERVER_HOST=..., JWT_SECRET, CORS_ORIGINS).

## 📋 Features & Flujo
- RBAC (middleware/roles), fuzzy search, reports (PDF?), WS notifs, Telegram integration.
- Flujo: Login → Dashboard stats → CRUD tickets/sugs/projects → WS updates → Admin mgmt.

**¡Mapa completo - Sistema listo para producción!** ✅


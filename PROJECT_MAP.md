# Mapa Completo del Proyecto SUGERENCIAS_TICKETS (SOHO Systems Core v1.0.0 - ACTUALIZADO)

## 🏗️ Estructura de Directorios (Árbol Completo - ACTUALIZADO 2024)

```
SUGERENCIAS_TICKETS-main/
├── .gitconfig, .gitignore
├── AUDITORIA_TECNICA.md, design_guidelines.json
├── DOCUMENTO_PROYECTO_ANALISIS.md, README-docker.md, README.md, SECURITY_FIXES_EXECUTABLE.md, test_result.md
├── docker-compose.yml - Docker multi-container
├── role_based_test.py, backend_test.py? 
├── PROJECT_MAP.md - Este archivo (actualizado)
├── TODO.md - Tracking progreso
├── data/ (mssql/)
├── memory/.gitkeep
├── test_reports/ (iteration_1.json, iteration_2.json, pytest/.gitkeep)
├── tests/__init__.py
├── backend/
│   ├── Dockerfile, package.json (v1.0.0), package-lock.json, requirements.txt?, test-db.js
│   └── src/
│       ├── app.js - Express app + middleware stack
│       ├── server.js - HTTP/WS server port 4000, ticketWatcher
│       ├── config/ (db.js MSSQL, env.js)
│       ├── middleware/ (auth.js, roles.js, rateLimiter.js, errorHandler.js, validate.js, authenticateInternal.js)
│       ├── models/ (10+: User.js, Ticket.js, Suggestion.js, Project.js, Hotel.js, Department.js, Role.js, Notification.js, Attachment.js, SolutionType.js, TicketType.js)
│       ├── routes/ (17+): auth.routes.js, users.routes.js, tickets.routes.js, ticketTypes.routes.js, ticketreport.routes.js, suggestions.routes.js, projects.routes.js, hotels.routes.js, maphotels.routes.js, departments.routes.js, notifications.routes.js, roles.routes.js, solutionTypes.routes.js, seed.routes.js, seed.js, attachments.js, dashboard.routes.js, internal.routes.js
│       ├── services/ (userTelegram.service.js)
│       ├── utils/ (constants.js, fuzzy.js, helpers.js, hoteles.json, hotelsData.js, reportGenerator.js, ticketWatcher.js, wsBroadcaster.js)
│       └── bot/telegramBot.js (Telegraf)
├── database/
│   ├── Dockerfile, schema.sql, schema.txt, basedd.ipynb, BasedeDatos(Soporte).txt, consultaH-U.txt, basedds.txt
├── frontend/
│   ├── Dockerfile, nginx.conf, package.json (v0.1.0), package-lock.json?, craco.config.js, tailwind.config.js, postcss.config.js, jsconfig.json, components.json
│   ├── .gitignore, public/favicon.png, index.html
│   ├── plugins/health-check/ (health-endpoints.js, webpack-health-plugin.js)
│   └── src/
│       ├── App.js, App.css, index.js, index.css
│       ├── components/layout/ (DashboardLayout.js, Sidebar.js, TopBar.js)
│       ├── components/ui/ (30+ shadcn/ui: accordion.jsx, alert.jsx, badge.jsx, button.jsx, card.jsx, dialog.jsx, input.jsx, table.jsx, tabs.jsx, toast.jsx, etc.)
│       ├── config/msalConfig.js (Azure AD/MSAL)
│       ├── contexts/ (AuthContext.js, authService.js, NotificationContext.js, ThemeContext.js)
│       ├── hooks/ (use-toast.js, useInterval.js, useTelegram.js)
│       ├── lib/ (api.js axios, cache.js, utils.js, ws.js)
│       └── pages/ (DashboardPage.js, LoginPage.js, TicketsPage.js/Detail, SuggestionsPage.js/Detail, ProjectsPage.js/Detail, + admin/ 8 pages: DepartmentsPage.js etc.)
```

## 🛠️ Stack Tecnológico (Versiones Confirmadas + Inferidas)

| Capa | Tecnologías Principales |
|------|-------------------------|
| **Backend** | Node.js 18+, Express 4.18+, mssql 10+, SQL Server, telegraf 4.16+, ws 8+, helmet 8+, express-rate-limit 8+, jsonwebtoken 9+, (package.json v1.0.0) |
| **Frontend** | React 18.2+, react-router-dom 6/7, TailwindCSS 3.4+, shadcn/ui + Radix, recharts, leaflet (maps), react-hook-form, zod, sonner, MSAL (msalConfig.js), craco, (package.json v0.1.0) |
| **DB** | SQL Server (schema.sql: 13 tables + views/procs/triggers) |
| **Infra** | Docker (compose.yml, 3 Dockerfiles: backend/database/frontend), nginx.conf |
| **Real-time** | WebSockets (ws://:4000/ws JWT), ticketWatcher polling |
| **Tests/CI** | pytest (role_based_test.py), Jest (test-db.js), test_reports/ JSON iterations |
| **Other** | Telegram Bot, fuzzy search, PDF reports? (reportGenerator.js) |

## 📐 Arquitectura (Mermaid)

```mermaid
graph TB
    subgraph FRONTEND ['React 18 + shadcn/ui + Tailwind']
        A[App.js + Router] --> B[Protected: DashboardLayout/Sidebar/TopBar]
        B --> C[Pages: 17 total (Tickets/Suggestions/Projects + Admin 8)]
        D[shadcn 30+ components + charts/maps]
        E[Contexts: Auth(MSAL/JWT), Notifications, Theme]
        F[hooks: useTelegram/toast/interval]
        G[lib: axios api.js, ws.js realtime]
    end
    
    subgraph BACKEND ['Node/Express v1.0.0']
        H[server.js port 4000 HTTP+WS]
        H --> I[app.js: CORS/helmet/auth/roles/rate-limit + 17 routes]
        I --> J[Controllers/Models -> MSSQL]
        K[utils: wsBroadcaster, ticketWatcher(5s poll), fuzzy, hotelsData]
        L[bot/telegramBot.js + userTelegram.service]
    end
    
    subgraph DB ['SQL Server - database/schema.sql']
        M[13 Tables + views (vw_tickets_full) + procs/triggers]
    end
    
    subgraph INFRA ['Docker']
        N[docker-compose.yml]
    end
    
    G -.->|WS| H
    G -->|API| I
    I --> M
    L -.->|Telegram| K
    
    classDef fe fill:#3b82f6
    classDef be fill:#f97316
    classDef db fill:#10b981
    classDef infra fill:#8b5cf6
    class FRONTEND,BACKEND,DB,INFRA fe,be,db,infra
```

## 🔌 Backend API Routes (17+ Confirmadas)
- `auth.routes.js` (login/register/me/microsoft)
- `users.routes.js`, `roles.routes.js`
- `tickets.routes.js`, `ticketTypes.routes.js`, `ticketreport.routes.js`
- `suggestions.routes.js`
- `projects.routes.js`
- `hotels.routes.js`, `maphotels.routes.js`
- `departments.routes.js`
- `notifications.routes.js`, `attachments.js`
- `dashboard.routes.js`, `solutionTypes.routes.js`, `seed.routes.js`, `internal.routes.js`

## 🧭 Frontend Pages (17+)
**Public**: `/login`
**Protected** (`/dashboard` base?):
- DashboardPage, TicketsPage/:id, SuggestionsPage/:id, ProjectsPage/:id
- Admin: DepartmentsPage, Hotels?, Roles, TicketTypes, TicketsReport, MapHotels, SolutionTypes

## 🗄️ DB Schema (13+ Tables)
Users, Hotels, Tickets, Suggestions, Projects, Departments, Roles, TicketTypes, Notifications, Attachments, SolutionTypes + Comments?

Views/Procs: vw_tickets_full, sp_get_dashboard_stats etc.

## 🚀 Deployment & Run

**Dev Local:**
```
# Backend
cd backend && npm install && npm run dev  # :4000

# Frontend
cd frontend && yarn install && yarn dev   # :3000

# DB (optional docker)
docker-compose up db
```

**Docker Prod:**
```
docker-compose up -d  # backend + frontend + database + nginx?
```

**.env.example**: SQLSERVER_HOST, JWT_SECRET, CORS_ORIGINS, TELEGRAM_TOKEN?, AZURE_CLIENT_ID (MSAL).

**Seed**: `POST /api/seed` (admin user).

## 📋 Features Clave
- **RBAC**: middleware/roles (admin/technician/hotel/central)
- **Realtime**: WS broadcaster + ticketWatcher
- **Telegram**: Bot integration + notifications
- **Search**: Fuzzy matching (utils/fuzzy.js)
- **Reports**: ticketreport + PDF? (reportGenerator.js)
- **Maps**: Leaflet? + maphotels
- **Auth**: JWT + MSAL (Azure)
- **Health**: plugins/health-check
- **Tests**: pytest iterations saved in test_reports/

**¡Proyecto Full-Stack Completo - Listo para Deploy!** ✅

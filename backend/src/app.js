// src/app.js
const express    = require('express');
const cors       = require('cors');
const path = require('path');
const { CORS_ORIGINS } = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const cookieParser = require('cookie-parser');
// ---------- IMPORTAR RUTAS ----------
const authRoutes          = require('./routes/auth.routes');
const usersRoutes         = require('./routes/users.routes');
const ticketsRoutes       = require('./routes/tickets.routes');
const hotelsRoutes        = require('./routes/hotels.routes');
const departmentsRoutes   = require('./routes/departments.routes');
const ticketTypesRoutes   = require('./routes/ticketTypes.routes');
const suggestionsRoutes   = require('./routes/suggestions.routes');
const projectsRoutes      = require('./routes/projects.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const seedRoutes          = require('./routes/seed.routes');
const rolesRoutes         = require('./routes/roles.routes');
const attachmentRoutes = require('./routes/attachments');
const dashboardRoutes = require('./routes/dashboard.routes');
const ticketsreportRoutes = require('./routes/ticketreport.routes');
const solutionsTypesRoutes = require('./routes/solutionTypes.routes');
const mapHotelsRoutes = require('./routes/maphotels.routes')
const rateLimiter = require('./middleware/rateLimiter');
const helmet = require('helmet');

const app = express();

/* -----------------------------------------------------------------
    Seguridad básica del framework
   ----------------------------------------------------------------- */
app.disable('x-powered-by');            // ocultar información de stack
app.use(
  helmet({
    contentSecurityPolicy: false,    // <-- importante: vamos a definirla a mano
    crossOriginEmbedderPolicy: false, // opcional, evita encabezado innecesario
  })
);                    // cabeceras de seguridad (HSTS, XSS‑Protection, …)


app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://us.i.posthog.com",
        "https://us-assets.i.posthog.com",
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
      ],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: [
        "'self'",
        "http://localhost:4000",            // API dev (HTTP)
        "ws://localhost:4000",              // WS dev
        "wss://tu-dominio-produccion.com", // WS prod
        "https://us.i.posthog.com",
        "https://us-assets.i.posthog.com",   // source‑maps
      ],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],            // reemplaza X‑Frame‑Options:DENY
      baseUri: ["'self'"],
    },
  })
);

/* -------------------------------------------------
   1️⃣ CORS y resto de la configuración (sin cambios)
   ------------------------------------------------- */
const allowedOrigins = CORS_ORIGINS.length
  ? CORS_ORIGINS
  : ['http://localhost:3000']; // fallback para dev

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Origen CORS no permitido'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
    ],
    optionsSuccessStatus: 200,
  })
);
app.options('*', cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --------------------------------------------------------
// 4️⃣  Rutas (después de CORS)
// --------------------------------------------------------

app.use('/api', authRoutes);               // públicas (login, register, etc.)

app.use('/api', require('./routes/internal.routes')); // rutas internas para el bot (sin autenticación, pero con secreto)
app.use('/api', usersRoutes);
app.use('/api', ticketsRoutes);
app.use('/api', hotelsRoutes);
app.use('/api', departmentsRoutes);
app.use('/api', ticketTypesRoutes);
app.use('/api', suggestionsRoutes);
app.use('/api', projectsRoutes);
app.use('/api', notificationsRoutes);
app.use('/api', rolesRoutes);
app.use('/api', seedRoutes);   // solo desarrollo
app.use('/api', attachmentRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', ticketsreportRoutes);
app.use('/api', solutionsTypesRoutes);


// --------------------------------------------------------
// 5️⃣  Endpoints de “salud” y raíz
// --------------------------------------------------------
app.get('/health', (_req, res) => res.json({ status: 'healthy' }));
app.get('/', (_req, res) =>
  res.json({ message: 'SOHO Systems Core API', version: '1.0.0' })
);
app.use('/api/map-hotels', mapHotelsRoutes);

app.use(rateLimiter.global);

// --------------------------------------------------------
// 6️⃣  Manejo de errores (último middleware)
// --------------------------------------------------------
app.use(errorHandler);

module.exports = { app };

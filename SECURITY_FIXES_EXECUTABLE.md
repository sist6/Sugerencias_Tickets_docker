# PLAN EJECUTABLE COMPLETO - LLM Auto-Implementación (Copia-Pega)

## 🎯 INSTRUCCIONES PARA LLM:
1. Ejecutar **exactamente** los comandos en orden
2. **SOLO** usar tools `execute_command`, `edit_file`, `read_file`
3. Verificar cada paso con `cat archivo` o logs
4. Al final: `attempt_completion`

---

## 🔴 PASO 1: CRÍTICAS (Helmet + Cookies + Rate Limit)

### 1.1 Instalar Dependencias
```
cd backend
npm install helmet express-rate-limit cookie-parser pino pino-pretty
npm audit fix
```

### 1.2 Helmet + Rate Limit (backend/src/app.js)
**EDIT** después de `const app = express();`:
```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const logger = pino({level: process.env.LOG_LEVEL || 'info'});

app.use(helmet());
app.use(cookieParser());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {error: 'Rate limit excedido'},
  standardHeaders: true
}));
```

### 1.3 Cookies httpOnly Backend (backend/src/routes/auth.routes.js)
**EN login response:**
```javascript
// ANTES res.json({access_token: token, user});
res.cookie('auth_token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000
});
res.json({user: safeUser}); // Sin token
```

### 1.4 Cookies Frontend (frontend/src/lib/api.js)
**AGREGAR función:**
```javascript
function getAuthToken() {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('auth_token='))
    ?.split('=')[1];
}

// Interceptor:
api.interceptors.request.use(config => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### 1.5 Remover localStorage (frontend/src/contexts/AuthContext.js)
**REEMPLAZAR todas:**
```
localStorage.setItem('token' → REMOVER
localStorage.getItem('token' → getAuthToken()
localStorage.removeItem('token' → REMOVER
```

### 1.6 Remover console.log Backend
```
cd backend/src
find . -name "*.js" -exec sed -i "s/console\.[olew]\{4,\}(/logger.\1/g" {} +
```

**TEST 1:** `curl -I localhost:4000/api/health` → `content-security-policy` presente

---

## 🟠 PASO 2: VALIDACIÓN INPUTS

### 2.1 express-validator ALL routes (ejemplo tickets.routes.js)
```
npm i express-validator
```
**POST/PUT middleware:**
```javascript
const {body, validationResult} = require('express-validator');

const validateTicket = [
  body('title').isLength({min:3, max:200}).trim().escape(),
  body('priority').isIn(['low','medium','high','critical']),
  body('department_id').isUUID(),
  (req, res, next) => {
    if (!validationResult(req).isEmpty())
      return res.status(400).json({errors: validationResult(req).array()});
    next();
  }
];
router.post('/', validateTicket, handler);
```

**APLICAR A:** tickets, users, suggestions, projects

### 2.2 SQL Secure (backend/src/config/db.js)
```
trustServerCertificate: false,
encrypt: true,
```

**TEST 2:** POST inválido → 400 JSON errors

---

## 🟡 PASO 3: MEDIAS

### 3.1 Pool MSSQL (config/db.js)
```javascript
pool: {max: 50, min: 10, idleTimeoutMillis: 30000}
```

### 3.2 XSS Sanitize (backend/src/utils/helpers.js)
```
npm i xss
module.exports.sanitize = require('xss')();
```

### 3.3 .env Secure
```
echo 'backend/.env' >> .gitignore
git rm -r --cached backend/.env 2>/dev/null
chmod 600 backend/.env
```

**TEST FINAL:**
```
npm audit → 0 issues
curl -v localhost:4000 → Helmet headers OK
Lighthouse Security → 100/100
```

## ✅ VERIFICACIÓN AUTOMÁTICA
```
echo "Security fixes completados ✅" > SECURITY_FIXED.md
```

**LLM: Ejecuta desde PASO 1.1 → attempt_completion al final**

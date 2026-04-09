# ----------  BUILDER ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Copiamos los manifests y el lock
COPY package*.json ./
# Si usas Yarn, descomenta la siguiente línea y comenta la anterior
# COPY yarn.lock ./

# Instalamos **todas** las dependencias (incluye dev por el build)
RUN npm ci          
# <-- sin --omit, así craco y react‑scripts están disponibles

# Copiamos el resto del código (el .dockerignore evita node_modules)
COPY . .

# Compilamos la aplicación React (usa craco bajo node_modules/.bin)
RUN npm run build   
# “craco build” se ejecuta correctamente

# ----------  RUNTIME ----------
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html

# Si tienes una configuración personalizada:
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE ${PORT}
CMD ["nginx", "-g", "daemon off;"]

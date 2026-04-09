# backend/Dockerfile - SOHO Systems Backend

FROM node:18-alpine

WORKDIR /app

# Copiar package.json y lockfile primero (cache de dependencias)
COPY package*.json ./
RUN npm ci --only=production --no-optional && npm cache clean --force

# Instalar wait-for-it para esperar DB
RUN apk add --no-cache wait-for-it

# Copiar código fuente
COPY src/ ./src/
# Copia todo el directorio utils si existe
COPY utils ./utils  

# Crear usuario no-root (seguridad)
RUN addgroup -g 1001 -S nodejs
RUN adduser -S sohoapp -u 1001
USER sohoapp

# Exponer puerto
EXPOSE 4000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (res)=>{process.exit(res.statusCode===200?0:1)})"

# CMD con espera a DB y start
CMD ["sh", "-c", "wait-for-it db:1433 --timeout=60 --strict -- npm start"]


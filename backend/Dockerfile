# ----------  BUILDER ----------
FROM node:20-alpine AS builder
WORKDIR /app

# wait‑for‑it (opcional)
RUN apk add --no-cache curl && \
    curl -L https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh \
    -o /usr/local/bin/wait-for-it && \
    chmod +x /usr/local/bin/wait-for-it

# Instalamos solo las dependencias de **producción**
COPY package*.json ./
RUN npm ci --omit=dev --omit=optional   
# <-- no dev, solo prod

# Copiamos el código fuente (el .dockerignore excluye node_modules)
COPY . .

# Si tu proyecto usa TypeScript:
# RUN npm run build

# ----------  RUNTIME ----------
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app /app

EXPOSE ${PORT}

# Opcional: esperar a la DB antes de arrancar
# ENTRYPOINT ["/usr/local/bin/wait-for-it", "db:1433", "--", "node", "src/index.js"]
CMD ["node", "src/server.js"]

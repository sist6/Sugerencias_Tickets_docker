FROM node:18-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 1000000

# Copiar código fuente y build
COPY . .
RUN yarn build

# Stage de producción con Nginx
FROM nginx:alpine

# Copiar build del frontend
COPY --from=builder /app/build /usr/share/nginx/html

# Copiar config nginx personalizada
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]


# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar package.json primero (cache de dependencias)
COPY package*.json ./
RUN npm ci

# Copiar código y buildear
COPY . .
RUN npm run build

# Stage 2: Nginx
FROM nginx:alpine

# Copiar build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar config nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
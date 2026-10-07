FROM node:22-alpine

WORKDIR /app

# Instalar dependencias del sistema para native modules
RUN apk add --no-cache python3 make g++

# Copiar package.json primero (cache de dependencias)
COPY package*.json ./
RUN npm ci --production

# Copiar código
COPY . .

# Usuario no-root
USER node

EXPOSE 3001

CMD ["node", "src/index.js"]
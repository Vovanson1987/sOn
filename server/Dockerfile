FROM node:20-alpine

# Создаём директорию и устанавливаем права для non-root пользователя
WORKDIR /app

# curl нужен для healthcheck
RUN apk add --no-cache curl

COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force

COPY *.js ./

# Переключаемся на встроенного non-root пользователя
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "index.js"]

# Используем официальный Node.js образ (Alpine для меньшего размера)
FROM node:18-alpine

# Настройка быстрых зеркал Alpine для ускорения установки пакетов
RUN sed -i 's/dl-cdn.alpinelinux.org/mirror.yandex.ru\/mirrors\/alpine/g' /etc/apk/repositories || true

# Устанавливаем curl для health check (быстрее чем wget)
RUN apk add --no-cache curl

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json
COPY package.json ./

# Устанавливаем зависимости
RUN npm install --only=production

# Копируем остальные файлы приложения
COPY . .

# Создаем непривилегированного пользователя для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["node", "server.js"]

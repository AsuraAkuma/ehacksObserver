FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
ENV NODE_ENV=production
ENV WEBHOOK_PORT=5508
ENV WEBHOOK_HOST=0.0.0.0
EXPOSE 5508
CMD ["node", "app.js"]

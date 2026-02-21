FROM node:20-alpine AS builder
WORKDIR /app

COPY sdk/src/ ./sdk/src/
COPY sdk/tsconfig.json ./sdk/

COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci
COPY frontend/tsconfig.json frontend/vite.config.ts frontend/tailwind.config.js frontend/postcss.config.js frontend/index.html ./
COPY frontend/src/ ./src/
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]

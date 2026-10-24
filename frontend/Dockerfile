# Build stage
FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS builder

WORKDIR /app

# Copiar package.json
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

# Instalar dependencias (incluindo devDependencies para build)
RUN npm ci --ignore-scripts

# Copiar codigo fonte
COPY frontend ./frontend
COPY scripts/third-party-notices.mjs ./scripts/third-party-notices.mjs
COPY LICENSE THIRD_PARTY_NOTICES.md ./

# Build usando caminhos diretos
RUN npm run build --workspace=frontend

# Runtime stage - usar nginx para servir arquivos estaticos
FROM nginx:stable-alpine@sha256:ed84151ed2d47ef93c0939eb9b9754c6990db6092cd2081e11988a47a83d47ea

# Copiar configuracao nginx
COPY frontend/nginx.conf /etc/nginx/nginx.conf

# Copiar build do stage anterior
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY LICENSE THIRD_PARTY_NOTICES.md /usr/share/nginx/html/legal/
RUN mkdir -p /tmp/nginx/client_body /tmp/nginx/proxy /tmp/nginx/fastcgi /tmp/nginx/uwsgi /tmp/nginx/scgi \
  && chown -R nginx:nginx /tmp/nginx /usr/share/nginx/html
USER nginx

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Iniciar nginx
CMD ["nginx", "-g", "daemon off;"]

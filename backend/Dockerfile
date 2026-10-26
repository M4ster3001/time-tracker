FROM node:26-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS builder

# openssl (runtime) so Prisma detects OpenSSL 3 and emits linux-musl-openssl-3.0.x.
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pkgconf \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    pixman-dev \
    openssl \
    openssl-dev

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --ignore-scripts
COPY backend ./backend
COPY scripts/third-party-notices.mjs ./scripts/third-party-notices.mjs
RUN npm run db:generate --workspace=backend \
  && npm rebuild canvas \
  && npm run build --workspace=backend \
  && npm prune --omit=dev --ignore-scripts
RUN node scripts/third-party-notices.mjs .cache/runtime-notices

FROM node:26-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797

# Runtime OS deps for canvas/openssl/backups. apk upgrade picks available Alpine fixes.
# Bundled npm/yarn/corepack are removed: the app runs with `node` only.
RUN apk add --no-cache \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    pixman \
    openssl \
    mariadb-client \
    fontconfig \
    font-dejavu \
    ca-certificates \
  && apk upgrade --no-cache \
  && rm -rf \
    /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /opt/yarn-v* \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack

WORKDIR /app/backend
ENV NODE_ENV=production
ENV BACKUP_LOCAL_PATH=/app/backups

COPY --chown=node:node backend/package.json ./
COPY --from=builder --chown=node:node /app/backend/prisma ./prisma
# npm workspaces hoist most deps to /app/node_modules, but some (e.g. googleapis)
# stay nested under backend/node_modules — both trees are required at runtime.
# `prisma` is a production dependency so migrate deploy works without npm/npx.
COPY --from=builder --chown=node:node /app/node_modules /app/node_modules
COPY --from=builder --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/backend/dist ./dist
COPY --chown=node:node backend/docker-entrypoint.sh /app/backend/docker-entrypoint.sh
COPY --chown=node:node LICENSE THIRD_PARTY_NOTICES.md /app/legal/
COPY --from=builder --chown=node:node /app/.cache/runtime-notices /app/legal/dependencies/
RUN mkdir -p /app/backups \
  && chmod +x /app/backend/docker-entrypoint.sh \
  && chown node:node /app/backups /app/backend/docker-entrypoint.sh
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Invoke via sh so CRLF-on-checkout hosts still boot; script itself should be LF.
ENTRYPOINT ["/bin/sh", "/app/backend/docker-entrypoint.sh"]

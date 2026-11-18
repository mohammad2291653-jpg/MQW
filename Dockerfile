# syntax=docker/dockerfile:1
# Node 24 supports the SQLite development fallback and async PostgreSQL runtime.
# Keep build dependencies and migration credentials out of the runtime image.
FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS base

FROM base AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    MQW_STORAGE_BACKEND=sqlite \
    MQW_DATA_DIR=/tmp/mqw-build-data
COPY package.json package-lock.json ./
# Copy an explicit source allowlist, never the working tree's data or .env files.
COPY next.config.ts tsconfig.json ./
COPY src ./src
COPY public ./public
COPY scripts/start-production.mjs ./scripts/start-production.mjs
COPY scripts/backup.mjs ./scripts/backup.mjs
# Package runtime files within the same layer as compilation. This keeps build
# dependencies/caches out of the final image and avoids duplicating huge
# dependency trees across filesystem layers on VFS Docker builders.
# The optional proxy CA is a temporary BuildKit secret, never a copied file.
RUN --mount=type=secret,id=mqw_build_ca \
    if [ -f /run/secrets/mqw_build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/mqw_build_ca; fi; \
    npm ci --no-audit --no-fund \
    && npm run build \
    && npm prune --omit=dev --no-audit --no-fund \
    && rm -rf node_modules/@playwright node_modules/playwright node_modules/playwright-core node_modules/@axe-core node_modules/tsx \
    && rm -f node_modules/.bin/playwright node_modules/.bin/playwright-core node_modules/.bin/tsx \
    && rm -rf .next/cache /root/.npm \
    && mkdir -p /runtime/scripts \
    && mv node_modules .next public package.json package-lock.json next.config.ts /runtime/ \
    && mv scripts/start-production.mjs /runtime/scripts/ \
    && mv scripts/backup.mjs /runtime/scripts/ \
    && mkdir -p /runtime/.next/cache

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=10000 \
    MQW_STORAGE_BACKEND=postgres
COPY --chown=node:node --from=build /runtime/ ./
# No persistent volume or schema migration is required by the remote runtime.
# The restricted runtime URL is supplied only at startup, never as a build ARG.
# Startup drops to uid/gid 1000 before Next; the optional SQLite fallback alone
# initializes a mounted directory when explicitly selected by the operator.
USER root
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||10000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/start-production.mjs"]

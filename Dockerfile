FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3443 \
    HTTPS_ENABLED=true \
    BASE_PATH=/scout
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node scripts/docker-entrypoint.sh /usr/local/bin/scout-entrypoint
RUN chmod 755 /usr/local/bin/scout-entrypoint && mkdir -p /app/.certs /app/data && chown node:node /app/.certs /app/data
USER node
EXPOSE 3001 3443
ENTRYPOINT ["scout-entrypoint"]
CMD ["node", "dist/node/server/src/index.js"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD NODE_TLS_REJECT_UNAUTHORIZED=0 node -e "fetch('https://127.0.0.1:3443/scout/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

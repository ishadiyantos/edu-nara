FROM node:22-bookworm AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY svelte.config.js vite.config.ts tsconfig.json ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm check && pnpm build
RUN pnpm prune --prod --ignore-scripts

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/app/data/edu-nara.db LOG_LEVEL=info
RUN mkdir -p /app/data && chown node:node /app/data
COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/src/lib/server ./src/lib/server
COPY --from=builder --chown=node:node /app/src/lib/validation.ts ./src/lib/validation.ts
COPY --from=builder --chown=node:node /app/scripts/start.ts /app/scripts/backup.ts /app/scripts/scheduled-backup.ts /app/scripts/maintenance.ts ./scripts/
USER node
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "scripts/start.ts"]

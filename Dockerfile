# =====================================================================
# Edu Nara — Multi-stage Dockerfile (arm64-ready untuk Raspberry Pi 5)
# =====================================================================

# ---- Stage 1: build ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy manifest dulu untuk caching layer install
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml .npmrc ./
# Build scripts tidak diperlukan untuk dependency Fase 0; hindari approval interaktif pnpm.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source & build
COPY . .
RUN pnpm build

# Prune dev deps
RUN pnpm prune --prod


# ---- Stage 2: runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Non-root user
RUN addgroup -S nara && adduser -S nara -G nara \
    && mkdir -p /app/data/uploads \
    && chown -R nara:nara /app

USER nara

# Copy build output + prod deps
COPY --chown=nara:nara --from=builder /app/build ./build
COPY --chown=nara:nara --from=builder /app/node_modules ./node_modules
COPY --chown=nara:nara --from=builder /app/package.json ./package.json

# Volume untuk DB SQLite + uploads
VOLUME ["/app/data"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", "build/index.js"]

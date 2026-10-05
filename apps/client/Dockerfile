# Build from the MONOREPO ROOT, not this directory:
#   docker build -f apps/client/Dockerfile -t client .
#
# Mirrors packages/api/Dockerfile's turbo-prune pattern (the pruned lockfile
# needs the whole workspace). The client is a static SPA: `vite build` emits
# plain files, served by nginx — no Node/Bun runtime in the final image.

FROM oven/bun:1.3.13-slim AS base

# ---- prune: extract only what `client` needs from the monorepo ----
FROM base AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo prune client --docker

# ---- install: full install (vite build needs devDependencies) ----
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile

# ---- build ----
# VITE_API_URL is a BUILD-TIME value baked into the bundle — the API origin
# as reachable from the user's browser. Override with --build-arg.
FROM installer AS builder
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
COPY --from=pruner /app/out/full/ .
RUN bunx turbo build --filter=client

# ---- runtime: static files behind nginx ----
FROM nginx:1.29-alpine AS runner
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/client/dist /usr/share/nginx/html
EXPOSE 80

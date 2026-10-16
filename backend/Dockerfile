# syntax=docker/dockerfile:1.7
#
# Seti backend image — provider-agnostic, ARM64-native.
#
# The target is Oracle Cloud Always Free Ampere A1, which is **ARM64 (aarch64)**.
# This file pins no architecture: every base image below is a multi-arch manifest
# that includes `linux/arm64`, and the only CPU-sensitive step — `prisma generate`
# — runs *inside the build stage*, so the Prisma query engine it downloads is the
# one for the platform being built. Build it on the A1 (`docker build`) and you get
# an arm64 image; build it on an x86 laptop and you get amd64. Nothing here has to
# change between the two.
#
# Build context is the REPOSITORY ROOT, not backend/ — the repo is an npm
# workspace with a single root package-lock.json, and `npm ci` needs it. From the
# repo root:
#
#   docker build -f backend/Dockerfile -t seti-backend .
#
# or let docker-compose.yml do it (it sets context: . and dockerfile: backend/Dockerfile).
#
# NOTE ON RUNTIME DEPENDENCIES: the image adds nothing to the application's
# `dependencies`. openssl/ca-certificates are OS packages Prisma's engine needs,
# and the Prisma CLI rides along only so the `migrate` stage below can run
# `prisma migrate deploy` as a release step. That is the same CLI the repo's own
# docs/operations.md §3 prescribes; it is not a new app dependency.
#
# SCOPE: only the `seti-backend` workspace is installed. A bare `npm ci` would
# also drag in the web app's toolchain (Next, Vite, Wrangler) — hundreds of MB
# this image will never execute. The web app has its own deploy
# (docs/operations.md §7).

ARG NODE_VERSION=20

# ---------------------------------------------------------------------------
# base — shared OS layer. Deliberately Debian bookworm-slim, not alpine: Prisma
# ships prebuilt engines for Debian's glibc and needs `openssl` present, and the
# musl/alpine combination is a well-known source of "engine could not be found"
# failures at container start. Reliability beats a few MB on a free-tier box.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------------------------------------------------------------------------
# deps — install ONLY the backend workspace from the single root lockfile.
# NODE_ENV is intentionally NOT set here: with NODE_ENV=production `npm ci` would
# omit devDependencies, and the build stage needs typescript and prisma.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
# The workspace list in the root package.json names `web`; its package.json must
# exist for `npm ci` to resolve the tree (only the manifest — the source is not
# needed and is excluded by .dockerignore).
COPY web/package.json ./web/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace seti-backend --include-workspace-root=false --include=dev

# ---------------------------------------------------------------------------
# build — generate the Prisma client for the target platform, then compile the
# backend workspace (tsc → backend/dist). `prisma generate` must run before tsc,
# because the source imports the generated client's types.
# ---------------------------------------------------------------------------
FROM deps AS build
COPY backend ./backend
WORKDIR /app/backend
RUN --mount=type=cache,target=/root/.npm \
    mkdir -p /app/backend/node_modules \
 && npx prisma generate \
 && npm run build

# ---------------------------------------------------------------------------
# migrate — full toolchain, for the one-shot release step
#   docker compose run --rm migrate
# which runs `prisma migrate deploy` against the DATABASE_URL in the environment.
# Non-interactive by design (see docs/operations.md §3 — never `migrate dev`).
# ---------------------------------------------------------------------------
FROM deps AS migrate
COPY backend ./backend
WORKDIR /app/backend
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------------------
# runner — the image that serves the API and runs the indexer worker.
# NODE_ENV=production is the default here so the backend's own boot guard is
# active: an incomplete or insecure config must fail loudly at start, never boot
# healthy and serve nobody. The real values come from the environment file the
# operator supplies (docker-compose `env_file`, or systemd `EnvironmentFile=`).
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# Both node_modules trees: npm hoists shared packages to the root and leaves the
# rest under the workspace. `mkdir` in the build stage guarantees the second path
# exists so this COPY cannot fail on a different hoisting layout.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/dist ./backend/dist
WORKDIR /app/backend

# Run unprivileged; the node user ships with the base image.
USER node

# The API listens here. The worker (command override) binds nothing.
EXPOSE 4000

# Default command starts the API. The indexer service overrides it with
# `node dist/worker.js`. HOST is set to 0.0.0.0 inside the container because the
# *container* must accept the docker network's traffic; the port is only ever
# published to 127.0.0.1 on the host by docker-compose.yml.
CMD ["node", "dist/index.js"]

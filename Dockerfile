# syntax=docker/dockerfile:1

# Builder
FROM node:22-bullseye AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts --legacy-peer-deps
COPY . .
ENV NODE_ENV=production
RUN npm run build && npx prisma generate

# Runtime (slim, copies only build artifacts)
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
  PORT=3000 \
  DATABASE_URL=file:/data/sqlite.db \
  DATABASE_PATH=/data/sqlite.db \
  CACHE_DATABASE_PATH=/data/cache.db

RUN apt-get update && \
  apt-get install -y --no-install-recommends openssl ca-certificates && \
  rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/app ./app
COPY --from=builder /app/server ./server
COPY --from=builder /app/server-build ./server-build
COPY --from=builder /app/index.js ./index.js
COPY --from=builder /app/app/utils/job-queue.server.ts ./app/utils/job-queue.server.ts

VOLUME ["/data", "/app/uploads"]
EXPOSE 3000

CMD ["sh", "-c", "mkdir -p ${LITEFS_DIR:-/data/litefs} && npx prisma migrate deploy && npm run start"]

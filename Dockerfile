# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Ansora — self-hosted build.
#
# Multi-stage: install deps -> build -> minimal standalone runtime.
# Content is NOT baked in here; mount a volume at /app/content (see
# docker-compose.yml) so posts survive container rebuilds.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies (uses the lockfile for reproducibility)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runtime
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Standalone output bundles server code + externalized node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Seed content (overridden at runtime by the mounted volume).
COPY --from=builder --chown=nextjs:nodejs /app/content ./content

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]

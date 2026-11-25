# syntax=docker/dockerfile:1.7
# Brand AI production image. Build: docker build -t brand-ai .
# Configuration comes only from the environment at run time (see .env.example);
# no secrets are baked into the image. No OS packages are needed: Prisma uses
# the MariaDB driver adapter (no native engine) and the health check uses Node.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.mjs ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
# Placeholder values only for the build step (env validation); real values are supplied at run time.
RUN DATABASE_URL="mysql://build:build@localhost:3306/build" NEXTAUTH_SECRET="build-only" npm run build \
 && npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/next.config.mjs /app/prisma.config.mjs ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/src ./src
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, then serve. (With several instances, run `npx prisma migrate deploy` once as a release step instead.)
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p ${PORT}"]

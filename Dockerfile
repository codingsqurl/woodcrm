# --- build stage ---
# Node 22 LTS. Keep build + run on the SAME Node major so the better-sqlite3
# native addon's ABI matches. (Same recipe as the Woodchuckers719 site.)
FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- run stage ---
FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN useradd -m -u 10001 app

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Migrations are read at runtime (process.cwd()/db/migrations).
COPY --from=build /app/db ./db

USER app
EXPOSE 3000
CMD ["node", "server.js"]

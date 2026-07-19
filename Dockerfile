# --- Build stage: compile the React UI and the TS server -----------------
FROM node:22-alpine AS build
WORKDIR /app

# Server deps + build
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Web UI deps + build (outputs to /app/public)
COPY web/package.json web/package-lock.json* ./web/
RUN npm install --prefix web
COPY web ./web
RUN npm run build --prefix web

# --- Runtime stage -------------------------------------------------------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

# SQLite database location. Mount a volume at /app/data to persist across
# container restarts/redeploys.
ENV DB_FILE=/app/data/webhook.db
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server.js"]

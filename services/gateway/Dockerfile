# API gateway. Build context: the repo root (npm workspaces).
FROM node:24-slim AS build
WORKDIR /repo
COPY . .
RUN npm ci --no-audit --no-fund && npm run build -w services/gateway && npm prune --omit=dev && mkdir -p services/gateway/node_modules

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/node_modules ./node_modules
# Packages npm kept inside the workspace (not hoisted to the root).
COPY --from=build /repo/services/gateway/node_modules ./node_modules
COPY --from=build /repo/services/gateway/package.json ./
COPY --from=build /repo/services/gateway/dist ./dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --retries=12 CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]

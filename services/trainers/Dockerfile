# trainers service. Build context: the repo root (npm workspaces).
FROM node:24-slim AS build
WORKDIR /repo
COPY . .
RUN npm ci --no-audit --no-fund && npm run build -w services/trainers && npm prune --omit=dev && mkdir -p services/trainers/node_modules

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/node_modules ./node_modules
# Packages npm kept inside the workspace (not hoisted to the root).
COPY --from=build /repo/services/trainers/node_modules ./node_modules
COPY --from=build /repo/services/trainers/package.json ./
COPY --from=build /repo/services/trainers/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --retries=12 CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]

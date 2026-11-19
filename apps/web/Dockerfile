# GMS web app: built with Vite, served by nginx. Build context: the repo root (npm workspaces).
FROM node:24-slim AS build
WORKDIR /repo
COPY . .
RUN npm ci --no-audit --no-fund && npm run build -w apps/web

FROM nginx:1.29-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=5s --timeout=3s --retries=12 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

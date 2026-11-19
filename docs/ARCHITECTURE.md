# Fitelite GMS architecture

Microservices in one repository (a "monorepo"), everything in Docker. Decided by the Founder on
19 Nov 2026 (one repo per product; all products run in Docker).

## Layout

| Path | What it is |
| --- | --- |
| `apps/web` | The GMS web app (React + Vite + TypeScript), served by nginx in its own container. |
| `services/gateway` | The API gateway: the only entry point. `/api/<service>/...` goes to that service (prefix removed); everything else goes to the web app. |
| `services/<name>` | One microservice per business area (e.g. `classes`, `members`, `bookings`). |
| `compose.yaml` | Runs the whole product: `docker compose -f compose.yaml -f compose.local.yaml up --build`, then http://localhost:8088. |
| `scripts/new-service.mjs` | `npm run new-service <name>` creates a service from the standard skeleton. |

## Rules for every service

1. **Own API, own database.** Each service has its own Fastify API and its own PostgreSQL 18
   database (its own container in `compose.yaml`). No service reads another service's database;
   services talk to each other only over their HTTP APIs (through their compose service name,
   e.g. `http://members:3000`).
2. **Created with the generator.** `npm run new-service <name>`: it adds the folder, the
   Dockerfile, the database, the migrations folder, a test and the gateway route.
3. **Schema changes are migrations.** New numbered SQL files in `src/migrations/`
   (`002_add_classes.sql`, ...), applied once on start; never edit an applied file.
4. **Tested without servers.** Tests use PGlite (an in-memory PostgreSQL) through `memoryDb()`,
   and Fastify's `inject` for HTTP; `npm test` at the root runs every workspace's tests.
5. **Docker.** Every service and app has a Dockerfile (build context: the repo root). Containers
   listen on port 3000 (services), 8080 (gateway), 80 (web), have a `/health` check, and run as a
   non-root user. `compose.yaml` publishes no ports; only `compose.local.yaml` publishes the
   gateway. No `privileged`, host networking, host folders or extra capabilities.
6. **The web app calls the gateway** with relative paths (`api/classes/today`, no leading
   slash), so it works at any address, including the test environment's `/<featureId>/`.
7. **Configuration from the environment** (`DATABASE_URL`, `PORT`, `ROUTES`, ...); no secrets in
   the repo.

## Checks

CI (GitHub Actions, job `checks`) runs on every work branch and pull request: secret scan, install,
type check, tests, build, dependency audit, then builds every Docker image and starts the whole
product with `docker compose ... up --wait` and calls the gateway's `/health` and the web app.

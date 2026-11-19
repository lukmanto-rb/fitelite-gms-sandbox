# Fitelite GMS (sandbox)

The Gym Management System, built by the Fitelite AI squad. Microservices in one repository,
everything in Docker: see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

- Run it: `docker compose -f compose.yaml -f compose.local.yaml up --build`, then http://localhost:8088
- Add a service: `npm run new-service <name>`
- Checks: `npm test`, `npm run typecheck`, `npm run build`

# FIT-941 Trainers page: test-environment release (T4)

Target: http://localhost:8080/FIT-941/ on Rian's MacBook, started by the squad with Docker Compose
(`compose.yaml`). Test environment only. There is no production release, and nothing is merged without approval.

## Before starting

- `.env` next to `compose.yaml` must contain `GMS_SESSION_SECRET=<32 or more random characters>`.
  Without it, the gateway refuses every `/api` request. The page still opens, but it always shows
  "Couldn't load trainers. Try again." Never commit `.env`.

## Smoke check

After `docker compose up --build --wait`:

```
docker compose exec gateway node dist/smoke.js
```

The check runs inside the gateway container and uses the gateway's own `SESSION_SECRET`, so the secret is
never copied anywhere. It signs short-lived test sessions for a separate `smoke-check` workspace,
so no real gym's trainers are touched. It prints one PASS or FAIL line per step and exits non-zero if any step fails:

| Step | Covers |
|---|---|
| trainers service health | T4 smoke: service health through the gateway |
| add a trainer / trainer is listed | T4 smoke: add a trainer and see it listed (FR-006, FR-002) |
| still listed after a refresh | T4 smoke: refresh (FR-015, AC-017) |
| listed in a second signed-in session | AC-017 "another computer", as a second session |
| repeated add attempt creates one record | AC-012, AC-016 |
| signed-out request refused / other workspace does not see it | AC-018 |

Each run adds one trainer named `Smoke check <run id>` with the speciality `Release check` to the
`smoke-check` workspace only. The check is tested in `services/gateway/src/smoke.test.ts`.

## Manual checks

- **320 px:** open http://localhost:8080/FIT-941/#/trainers and narrow the browser to 320 px (or use
  the browser's device toolbar). Form, list values and retry buttons should all show with no sideways
  scrolling. The automated layout tests are in `TrainersPage.layout.test.tsx`.
- **Adding in the browser:** this needs a GMS session in the browser (the `gms_session` cookie). The
  repo has no sign-in screen (finding 1 in `FIT-941-review.md`). Browser adding works only once the
  sign-in approach Rian chose for the test environment is in place.

## Open questions (unchanged, interim behaviour only)

OQ-001 to OQ-004 are still waiting on Rian. The interim behaviour is in `docs/trainers.md`.

# FIT-941 Trainers page: review pack (T3)

PRD v1.0 (Notion 41d01fb75e0281afbe27de7e22d0a4c2) · Figma `avbkgNpFpt2rk4JGudCfdj` node 27-2 · Asana plan v2 (project 1220719453084897).
Status: **awaiting review approval. Do not merge without approval (T3).**

## Test run

On branch `squad/FIT-941-trainers-page-in-gms`, 2026-11-19, after `npm ci`:

| Workspace | Result |
|---|---|
| `apps/web` | 17 files, 132 tests, all passed (this includes the existing FIT-940 suites, which are unchanged) |
| `services/gateway` | 1 file, 11 tests, all passed |
| `services/trainers` | 1 file, 22 tests, all passed |
| **Total** | **19 files, 165 tests, all passed** |

`npm run typecheck` is clean, and `npm run build` succeeds for the web app, gateway and trainers service. The Dockerfile builds use these same build steps. **Docker Compose build: not run here,** because the build sandbox has no Docker. CI job `checks` and the T4 release build the images and run `compose up --wait`.

## Architecture check (docs/ARCHITECTURE.md)

| Rule | Result |
|---|---|
| Own API, own database | `services/trainers` with its own `trainers-db` (postgres:18) and volume. No other service reads it. |
| Created with the generator | Yes. The gateway route `ROUTES=/api/trainers=http://trainers:3000` is in compose.yaml. |
| Schema changes as migrations | `001_init`, `002_trainers`, `003_trainers_by_workspace`. These are new files only, and no applied file was edited. |
| Tested without servers | PGlite `memoryDb()` and Fastify `inject`. |
| Docker | Dockerfile, `/health`, non-root `node` user, port 3000. compose.yaml publishes no ports and uses no privileged mode, host networking, host folders or extra capabilities. |
| Web app calls the gateway with relative paths | `api/trainers/trainers`, no leading slash. Hash routes (`#/trainers`) make it work under `/FIT-941/`. |
| Configuration from the environment | `SESSION_SECRET` comes from `GMS_SESSION_SECRET` in `.env`. No secrets are in the repo. |

## Traceability: acceptance criteria

Test files: S = `services/trainers/src/app.test.ts`, G = `services/gateway/src/app.test.ts`, P = `apps/web/src/trainers/TrainersPage.test.tsx`, L = `TrainersPage.layout.test.tsx`, U = `trainers.test.ts`, A = `apps/web/src/App.test.tsx`.

| AC | Automated tests, all passing |
|---|---|
| AC-001 navigation and copy | A › Trainers nav opens page, marks it active; A › opens from URL (refresh); P › AC-001 copy |
| AC-002 List | P › Trainers / List; S › saves and lists (FR-006, FR-002) |
| AC-003 Empty | P › Trainers / Empty; S › lists nothing for an empty workspace |
| AC-004 Loading | P › Trainers / Loading (announced, form disabled); P › one retrieval under StrictMode |
| AC-005 Load Error | P › AC-005; A › load failure leaves navigation usable; U › failures never read as an empty list |
| AC-006 list retry → List/Empty | P › AC-006 (two tests) |
| AC-007 failed retry | P › AC-007 |
| AC-008 required / whitespace | P › AC-008 (three tests: both empty, whitespace speciality, whitespace name; focus first invalid); S › validation; U › validateTrainer |
| AC-009 name > 100 | P › AC-009; S › AC-009; U › 100 accepted, 101 rejected |
| AC-010 100-char international name | P › AC-010; S › AC-010 and code-point counting |
| AC-011 Adding | P › AC-011 |
| AC-012 repeated activation → one record | P › AC-012 (clicks + Enter) and end to end against the fake server; S › AC-012 concurrent submits |
| AC-013 Success | P › Trainers / Success (row once, cleared, "Trainer added." clears on edit) |
| AC-014 Save Error | P › AC-014 (two tests, including a thrown request) |
| AC-015 failed form retry | P › AC-015 (same attempt key) |
| AC-016 lost confirmation → one record | P › AC-016; S › AC-016; U › 200 replay accepted |
| AC-017 refresh / second session | S › AC-017 (fresh load, restart on the same DB, second session); A › refresh opens Trainers. **Live check pending at T4 (see Finding 1).** |
| AC-018 signed-out / other workspace denied | G › refuses signed-out, forged, expired and unconfigured requests; G › only the session's workspace is passed on; S › AC-018 (two tests) |
| AC-019 320 px, keyboard, screen reader | L › layout, 320 px wrapping, visible focus; P › native form, labels, table semantics, live regions, focus return. **Manual browser and screen-reader check pending at T4.** |
| AC-020 analytics privacy | P › AC-020 full-journey payload check; U › validation event reasons |

Requirements: FR-001 to FR-015, BR-001 to BR-006 and NFR-001 to NFR-008 are each covered by at least one of the ACs above, as mapped in the PRD's `verifies` lists. NFR-002 is also covered by S › error responses carry codes only. NFR-003 and NFR-006 are tested in code. Their WCAG and real-device parts need the manual check in AC-019.

## Prototype frames

All eight frames are built in `TrainersPage.tsx` (the state map is in its header comment) and tested by name in P: Trainers / Empty, List, Loading, Adding, Validation Error, Save Error, Load Error and Success. The copy in `trainers.ts` `COPY` matches PRD v1.0 word for word. Layout follows the PRD and prototype: a 360 px form card on the left, a 24 px gap, 24/16 px padding, and stacking below 1024 px.

## Review findings

1. **Blocking for the T4 live check: the test release has no way to sign in.** The PRD assumes an existing GMS sign-in (AS-001, DEP-002), but this repo has none. T1 added a signed-session check at the gateway, but there is no sign-in screen or other way to get a session. `GMS_SESSION_SECRET` is also unset by default, so the gateway refuses every `/api` request. At http://localhost:8080/FIT-941/, the page will open, but it will always show "Couldn't load trainers. Try again." Nobody can add a trainer there or check refresh and second-session persistence (AC-017, the T4 smoke test). This is secure and correct behaviour, but it is not demonstrable. Building a sign-in is outside the PRD and plan, so this is **raised to the GM for a decision** and was not built here.
2. No other defects found in the service (validation, idempotency, workspace scoping, error codes), the gateway session check or the page's state handling. No code was changed in T3.

## Open questions: interim behaviour only (still waiting on Rian)

| OQ | Status | Interim behaviour | Change point |
|---|---|---|---|
| OQ-001 speciality: free text or fixed list | proposed, undecided | Required free-text input, no list | `SPECIALITY_CONTROL` (web), `validateTrainer` (service) |
| OQ-002 staff roles | proposed, undecided | Anyone with a valid GMS session for the workspace may view and add | gateway and service `onRequest` hooks |
| OQ-003 list order | proposed, undecided | Stable creation order, no sort promised | `LIST_ORDER` (service); no client sort |
| OQ-004 same name and speciality | proposed, undecided | Not blocked. Only duplicate-submission protection (one `Idempotency-Key` = one record) | `POST /trainers`; no DB constraint |

## Deviations from plan v2

- Analytics: the app has no analytics mechanism, so the four events are built with only the listed properties and sent to a no-op sink. Nothing was installed.
- The "another computer" check (AC-017) is tested in code as a second session on the same database. The live check depends on Finding 1.
- Pull request: the squad pushes this branch and opens the pull request. Nothing is merged without approval.

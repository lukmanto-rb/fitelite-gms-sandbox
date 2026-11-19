# Trainers service (FIT-941)

`services/trainers`, its own PostgreSQL database `trainers-db`, reached through the gateway at
`/api/trainers` (the web app calls `api/trainers/trainers`).

## Sign-in and workspace (NFR-001, BR-006)

- The gateway refuses every `/api/...` request without a valid GMS session (`401 {"error":"unauthenticated"}`).
  A session is a token in the `gms_session` cookie or `Authorization: Bearer`, signed with
  `SESSION_SECRET` (`services/gateway/src/session.ts`). Without a secret of 32+ characters the
  gateway refuses all API requests (fails closed). The only exception is each service's own
  health check (`GET /api/<service>/health`, exact path), which carries no data. Set it as `GMS_SESSION_SECRET` in `.env`; never commit it.
- The gateway passes the workspace from the session in `x-gms-workspace` (and the staff id in
  `x-gms-user`), removing any `x-gms-*` header a browser sent, and does not forward the token.
- The trainers service refuses requests without `x-gms-workspace` and only reads and writes rows
  of that workspace.

## API

| Request | Answer |
| --- | --- |
| `GET /trainers` | `200 {"trainers":[{"id","name","speciality"}]}`: every trainer of the caller's workspace. |
| `POST /trainers` with `Idempotency-Key: <8–128 of A-Z a-z 0-9 _ ->` and `{"name","speciality"}` | `201 {"trainer":{...}}` created; `200` with the original record when the same attempt is repeated. |

Errors carry codes only (no trainer data, no free text):
`400 {"error":"validation","fields":{"name":"required"|"too_long","speciality":"required"}}`,
`400 {"error":"idempotency_key_required"}`, `400 {"error":"bad_request"}`,
`401 {"error":"unauthenticated"}`, `409 {"error":"idempotency_key_reused"}` (same key, different values),
`500 {"error":"service_error"}`.

Values are trimmed of surrounding whitespace; case, punctuation, internal spaces and international
characters are kept. Name: 1–100 characters (counted as Unicode code points) after trimming.

## Interim behaviour while open questions are undecided

| Question | Interim behaviour | Where to change it |
| --- | --- | --- |
| OQ-001 speciality: free text or fixed list | Required free text; no length rule beyond the 16 KB request limit; no list. | `validateTrainer` in `src/app.ts` |
| OQ-002 which staff roles | Anyone with a valid session for the workspace may view and add. | gateway `onRequest` hook / service `onRequest` hook |
| OQ-003 list order | Stable creation order; no sort is promised. | `LIST_ORDER` in `src/app.ts` |
| OQ-004 same name and speciality | Not blocked. Only one add attempt (one `Idempotency-Key`) = at most one record. | `POST /trainers` in `src/app.ts` (no DB constraint to undo) |

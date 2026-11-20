# FIT-941 Trainers page: test-environment release (T4)

Target: http://localhost:8080/FIT-941/ on Rian's MacBook, started by the squad with Docker Compose
(`compose.yaml`). Test environment only. There is no production release, and nothing is merged without approval.

**Not run yet:** none of the commands on this page have been run on the MacBook or in Docker.
The build sandbox has no Docker. The same flow (sign in, add, refresh, second browser) is covered by the
automated end-to-end test `tests/e2e/src/trainers.signedIn.e2e.test.tsx`, which is part of `npm test`.

## How sign-in works on the test release

It uses the existing GMS sign-in: the gateway's signed session (`gms_session`, signed with
`SESSION_SECRET`). There is no username and password. A staff member gets a **sign-in code** made
inside the gateway container, pastes it at http://localhost:8080/FIT-941/sign-in, and the browser
is then signed in to one gym (workspace) for 12 hours. People signed in to the same workspace see the
same trainers. A code for a different workspace sees none of them. http://localhost:8080/FIT-941/sign-out
signs the browser out.

## 1. Set up .env (once)

1. Open the **Terminal** app on the MacBook.
2. Go to the GMS folder (the copy of the repo on branch `squad/FIT-941-trainers-page-in-gms`), for example
   `cd ~/fitelite-gms-sandbox`.
3. Check whether the secret is already there:

   ```
   grep -c GMS_SESSION_SECRET .env
   ```

   If it prints `1`, skip to step 5. If it prints `0` or says "No such file", go to step 4.
4. Add a new random secret (64 characters) to `.env`:

   ```
   echo "GMS_SESSION_SECRET=$(openssl rand -hex 32)" >> .env
   ```

5. Never share this value, put it in chat or commit `.env` (git already ignores it). Without it, the
   gateway refuses every sign-in and every `/api` request, and the page always shows
   "Couldn't load trainers. Try again."

## 2. Start Docker

1. Open **Docker Desktop** and wait until it says it is running.
2. In the Terminal, in the GMS folder, start the test release and wait until the prompt comes back:

   ```
   docker compose up --build --wait
   ```

   If you changed `.env` while the product was already running, run the same command again so the
   gateway picks up the secret.

## 3. Smoke check

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

## Sign in in the browser

1. In the Terminal, make a sign-in code for yourself in the test gym `fitelite-test` and copy it to the
   clipboard:

   ```
   docker compose exec -T gateway node dist/signInCode.js rian fitelite-test | pbcopy
   ```

   (`rian` is the staff id and `fitelite-test` is the gym. Ids may use letters, digits, `-` and `_`.
   Add a number at the end for a different validity in hours, for example `... rian fitelite-test 2`.)
2. In **Safari**, open http://localhost:8080/FIT-941/sign-in.
3. Click in the **Sign-in code** box, paste (Cmd+V) and click **Sign in**.
4. You land on the Trainers page. The list loads, showing either "No trainers yet" or your trainers.
   If you see "That sign-in code is not valid or has expired.", make a new code (step 1). Check that
   `.env` has the secret and that you restarted after adding it.

## Check AC-017 on two browsers

Safari and Chrome keep separate cookies, so they behave like two computers. A Safari private window
works too if Chrome is not installed.

1. Sign in in **Safari** as above (staff id `rian`, gym `fitelite-test`).
2. On the Trainers page, enter a name (for example `Sofia García`) and a speciality (for example `Pilates`), then
   click **Add trainer**. Check that "Trainer added." appears and the trainer is listed **once**.
3. **Refresh** the page (Cmd+R). Check that the trainer is still listed once, with the same name and speciality.
4. Make a second code for the "other computer", with a different staff id but the **same gym**:

   ```
   docker compose exec -T gateway node dist/signInCode.js rian-second-computer fitelite-test | pbcopy
   ```

5. In **Chrome** (or a Safari private window), open http://localhost:8080/FIT-941/sign-in, paste the code
   and click **Sign in**.
6. Check that the same trainer is listed once, with the same name and speciality, without typing it again.
   AC-017 passes when steps 3 and 6 both show it.

Optional AC-018 checks in the browser:

- Open http://localhost:8080/FIT-941/sign-out in Chrome, then open http://localhost:8080/FIT-941/#/trainers.
  It should show "Couldn't load trainers. Try again." and no trainers.
- Make a code for another gym (`... signInCode.js visitor another-gym | pbcopy`), sign in with it in
  Chrome and check that the `fitelite-test` trainers are not listed.

## Manual check: 320 px

Open http://localhost:8080/FIT-941/#/trainers while signed in and narrow the browser to 320 px (or use
the browser's device toolbar). Form, list values and retry buttons should all show with no sideways
scrolling. The automated layout tests are in `TrainersPage.layout.test.tsx`.

## Open questions (unchanged, interim behaviour only)

OQ-001 to OQ-004 are still waiting on Rian. The interim behaviour is in `docs/trainers.md`.

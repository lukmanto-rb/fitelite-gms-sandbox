# FIT-941 Trainers page in GMS: release note v0.3.0 (rework 2)

Notion page (same page, same version, to be updated with this text):
https://app.notion.com/p/FIT-941-Trainers-page-in-GMS-v0-3-0-41e01fb75e02815b9869cdac96f7707b

Status: draft for GM review before it goes to Rian. Version 0.3.0. PRD v1.0.

## Summary

v0.3.0 adds a Trainers page to the Gym Management System (GMS). Staff can open Trainers from the navigation, see every saved trainer's name and speciality, and add new trainers. Trainers are saved centrally, so the list is shared across refreshes and computers within the same gym. This release is in the test environment for the Founder's review. No product validation results are available yet.

## Highlights

- New "Trainers" entry in the GMS navigation.
- Shared trainer list showing every trainer's name and speciality.
- Add a trainer with a required name and speciality.
- Saved trainers stay available after a refresh and on other computers in the same gym.
- Clear loading, empty and error messages. Failed loads and failed saves can be retried without losing entered details.

## New features

1. Trainers page, opened from a new "Trainers" entry in the GMS navigation. Other navigation and pages are unchanged.
2. "All trainers" list showing each saved trainer's name and speciality.
3. "Add trainer" form with Name and Speciality fields. Both fields are required, and names can be up to 100 characters.
4. Status messages: "Loading trainers…" while the list loads, and "No trainers yet" only when the gym has no trainers saved.
5. Retry for a failed list load ("Couldn't load trainers. Try again."), so staff can recover without leaving the page.
6. Retry for a failed save. Entered details and the current list are kept, and retrying will not create a duplicate trainer.
7. Confirmation "Trainer added." after a successful save. The new trainer appears straight away, without a page refresh.

## Known issues

- Trainers cannot be edited or deleted in this release. The list is view and add only.
- **Adding trainers in the browser is blocked: there is no sign-in screen.** The server only accepts signed-in staff, and this build has no way to sign in from the browser. Until a sign-in is added, the Trainers page opens but shows "Couldn't load trainers. Try again.", and trainers cannot be added or listed in the browser. The sign-in approach for the test environment has been reported as decided, but it is not part of this build. Adding, listing, refresh and access refusal can still be checked with the smoke check below.
- **OQ-001, Speciality (free text or fixed list), not yet decided.** For now, Speciality is a required free-text field with no list of options.
- **OQ-002, which staff may add trainers, not yet decided.** For now, anyone signed in to the gym's GMS can view and add trainers. There is no separate view-only access.
- **OQ-003, list order, not yet decided.** For now, trainers are shown in the order they were added. No sort order (such as alphabetical) is promised.
- **OQ-004, same name and speciality, not yet decided.** For now, adding a second trainer with the same name and speciality is allowed. Only accidental double submissions of one add attempt are prevented.

## Start the test release on the MacBook

**The live test release and the smoke check have not been run yet.** The build sandbox has no Docker, so nobody has started this version at http://localhost:8080/FIT-941/ or run the smoke check.

1. Open the Terminal app on the MacBook.
2. Go to the GMS folder (the copy of the repo on branch squad/FIT-941-trainers-page-in-gms).
3. Check that the file named .env in that folder has a line for GMS_SESSION_SECRET with at least 32 random characters. Without it, the page always shows "Couldn't load trainers. Try again." and the smoke check fails. Never share this value or put it in chat.
4. Start the test release and wait until the Terminal prompt comes back:

   ```
   docker compose up --build --wait
   ```

5. Run the smoke check:

   ```
   docker compose exec gateway node dist/smoke.js
   ```

6. Read the result. Each line starts with PASS or FAIL. All lines should say PASS. If any line says FAIL, copy the whole output and send it to the GM.
7. Open http://localhost:8080/FIT-941/#/trainers in the browser.

The smoke check adds one test trainer called "Smoke check" plus a number, with the speciality "Release check", in a separate test gym. Real gym data is not touched.

## How to test

1. Open http://localhost:8080/FIT-941/#/trainers. There is no sign-in screen yet, so you cannot sign in (see Known issues). Until sign-in is added, the page shows "Couldn't load trainers. Try again." and the steps below that load or add trainers cannot be done in the browser; the smoke check covers adding, listing, refresh and access refusal instead.
2. Select "Trainers" in the navigation. Check that the "Add trainer" heading, the Name and Speciality fields, the text "Both fields are required." and the "Add trainer" button are shown, and that other navigation is unchanged.
3. With no trainers saved, check that "No trainers yet" and "Add your first trainer using the form." appear.
4. Select "Add trainer" with empty or space-only fields. Check that "Enter a name." and/or "Enter a speciality." appear, and that no trainer is added.
5. Enter a name longer than 100 characters and select "Add trainer". Check that "Use 100 characters or fewer." appears.
6. Add a valid trainer, clicking the button several times. Check that "Adding…" appears, then "Trainer added.", that the trainer appears exactly once and that the form clears.
7. Add a trainer with a name of exactly 100 characters, including accents or punctuation. Check that the name is shown as entered.
8. Refresh the page, then open Trainers on another computer in the same gym. Check that the trainer is still listed.
9. If possible, simulate a save failure. Check that your entries are kept, the error message is shown and "Try again" does not create a duplicate.
10. If possible, simulate a list load failure. Check that the error and "Try again" are shown and that "No trainers yet" is not.
11. Sign out, or use an account without access to another gym. Check that trainers there cannot be viewed or added.
12. Check the page at 320 px wide and with a keyboard. Everything should be readable and usable without scrolling sideways.

## Test results

**Product validation: pending.** The Product Agent has not yet validated this build against the PRD, so there is no validation result to report. This section will be updated with the result once it exists.

**Automated tests: 170 passed, 0 failed** (`npm test` on commit ec3d416: web app 132, gateway 16, trainers service 22).
CI passed on the same commit: https://github.com/lukmanto-rb/fitelite-gms-sandbox/actions/runs/44664928881/job/136051782695

Results per acceptance criterion. "Automated" means checked by the passing tests above. "Live" means checked on the running test release, which has not happened yet.

| Criterion | What it checks | Automated | Live |
|---|---|---|---|
| AC-001 | Trainers opens from the navigation with the right heading, labels and button | Passed | Not run |
| AC-002 | List shows every saved trainer, no edit or delete | Passed | Not run |
| AC-003 | Empty gym shows "No trainers yet" | Passed | Not run |
| AC-004 | "Loading trainers…" while loading, form disabled | Passed | Not run |
| AC-005 | Load failure shows the error and "Try again", not "No trainers yet" | Passed | Not run |
| AC-006 | List retry starts one load and shows the result | Passed | Not run |
| AC-007 | A failed list retry shows the error again | Passed | Not run |
| AC-008 | Empty or space-only fields are rejected, values kept | Passed | Not run |
| AC-009 | Names over 100 characters are rejected | Passed | Not run |
| AC-010 | A 100-character name with accents or punctuation is kept as entered | Passed | Not run |
| AC-011 | "Adding…" while saving, no unconfirmed row | Passed | Not run |
| AC-012 | Repeated clicks create at most one trainer | Passed | Not run (also in the smoke check) |
| AC-013 | "Trainer added.", new row once, form cleared | Passed | Not run |
| AC-014 | Save failure keeps entries and the list, shows "Try again" | Passed | Not run |
| AC-015 | A failed save retry keeps entries and the list | Passed | Not run |
| AC-016 | Retry after a lost confirmation gives one trainer, not two | Passed | Not run (also in the smoke check) |
| AC-017 | Trainer still there after refresh and on another computer | Passed (a second signed-in session stands in for another computer) | Not run (in the smoke check; browser check blocked by sign-in) |
| AC-018 | Signed-out or other-gym access is refused | Passed | Not run (also in the smoke check) |
| AC-019 | Works at 320 px, by keyboard and with a screen reader | Passed (layout, focus, labels and announcements in code) | Not run (manual browser and screen-reader check still needed) |
| AC-020 | Analytics contain no names, specialities or personal data | Passed | Not run |

## Rollout

- Released to the test environment only. A production release requires approval.
- Adds new server-side storage for trainer records. No changes to existing data.
- Roll back by redeploying the previous version. Any trainer records added during testing would no longer be shown.

## Links

- PRD v1.0: https://app.notion.com/p/FIT-941-Trainers-page-in-GMS-41d01fb75e0281afbe27de7e22d0a4c2
- Asana project: https://app.asana.com/1/1219831674747828/project/1220719453084897
- Test environment: http://localhost:8080/FIT-941/
- Branch: https://github.com/lukmanto-rb/fitelite-gms-sandbox/tree/squad/FIT-941-trainers-page-in-gms

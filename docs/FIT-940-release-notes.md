# FIT-940 Classes today: test-environment release notes (T4)

PRD v1.0 (Notion 41901fb75e02811a841dced467709075) · Figma `avbkgNpFpt2rk4JGudCfdj` node 25-2 · Asana plan v2 · review pack: `docs/FIT-940-review.md`.

**Target:** http://localhost:8080/FIT-940/ only (test environment). **Not released to production.**

## How to build this release

The squad builds this release with **`npm run build:test-env`**, not `npm run build`. Only the test-env build turns on the test-only scenario selector, so Zero and Error can be reached with:

- http://localhost:8080/FIT-940/?scenario=normal shows "3" (this is also the default when no scenario is given)
- http://localhost:8080/FIT-940/?scenario=zero shows "0" and "No classes today"
- http://localhost:8080/FIT-940/?scenario=error shows "Unable to load classes." and "Try again". In this scenario every retry fails again (AC-007).

If the release is built with plain `npm run build`, the page always shows the normal scenario.

Build check, 2026-11-16: `npm run build:test-env` succeeds. `dist/index.html` loads `./assets/…` (relative paths, so it works under `/FIT-940/`), and the bundle contains `MODE: "test-env"`.

## Test run (evidence)

```
> fitelite-gms@0.1.0 test
> vitest run

 Test Files  12 passed (12)
      Tests  74 passed (74)
```

This includes the existing home-page suites (`HomePage.test.tsx`, `OpeningHoursCard.test.tsx`), which are unchanged.

## T4 smoke test (automated, against the test-env app)

`src/release.smoke.test.tsx` renders the whole `App` with Vite MODE `test-env`, at `/FIT-940/?scenario=…`, using the real sample loader and its 600 ms delay:

| Flow | Result |
|---|---|
| `?scenario=normal`: Loading with no count, then "3" | Pass |
| `?scenario=zero`: "0", "No classes today", "Sample data" | Pass |
| `?scenario=error`: Error with no count; three clicks on "Try again" start exactly one load; card shows Loading with no count or button; the retry fails and the card returns to Error with "Try again" | Pass |
| AC-008: "Today's opening hours" (06:00–22:00) and "Next class" (Spin at 18:30 with Alex) stay visible, in their original order, before "Classes today" through load, success, failure and retry | Pass |

The existing cards are static and have no interactions, so the AC-008 check covers whether they are visible, keep their order and keep their content.

## Traceability: acceptance criteria

| AC | Test(s), all passing | Manual check |
|---|---|---|
| AC-001 | `ClassesTodayCard.test.tsx` › AC-001; smoke test ("Sample data" in every step) | Pending on the test release |
| AC-002 | `ClassesTodayCard.test.tsx` › AC-002; `countClasses.test.ts`; smoke test (normal) | Pending: `?scenario=normal` |
| AC-003 | `ClassesTodayCard.test.tsx` › AC-003; `countClasses.test.ts`; smoke test (zero) | Pending: `?scenario=zero` |
| AC-004 | `ClassesTodayCard.test.tsx` › AC-004; `useClassesToday.test.tsx`; smoke test (Loading) | Pending |
| AC-005 | `ClassesTodayCard.test.tsx` › AC-005; smoke test (error) | Pending: `?scenario=error` |
| AC-006 | `ClassesTodayCard.test.tsx` › AC-006 (retry, then "3"); `useClassesToday.test.tsx` (one load); smoke test (three clicks start one load) | Retry then "3" cannot be shown on the release, because the error scenario always fails. It is covered by automated tests only. |
| AC-007 | `ClassesTodayCard.test.tsx` › AC-007; `useClassesToday.test.tsx`; smoke test (error retry) | Pending: `?scenario=error` |
| AC-008 | `HomePage.classesToday.test.tsx` (order and error boundary); `HomePage.test.tsx`; smoke test (all scenarios) | Pending on the test release |
| AC-009 | `ClassesTodayCard.test.tsx` › AC-009; `countClasses.test.ts` (no live import); `HomePage.classesToday.test.tsx` | — |
| AC-010 | `ClassesTodayCard.test.tsx` (live region, keyboard Retry, focus style, 16 px padding below 768 px) | **Pending:** check at 320 px width and with keyboard and screen reader across all four states |

## Open points

- **Test-only scenario selector**: Rian has not confirmed it yet. It has no visible UI, is set only through the URL, and works only in the test-env build.
- **OQ-001, OQ-002, OQ-003**: still open. There is no status filter, the test date D is the device's local date when the page opens, and the card has no navigation.
- **Analytics**: the app has no analytics mechanism. Events are built with only the allowed properties but go to a no-op sink. Nothing was installed.
- **Manual checks not done in the sandbox**: there is no browser or screen reader here, and starting a local server was not permitted. Someone needs to check the 320 px layout, keyboard use and screen reader (AC-010) and the in-browser smoke test on http://localhost:8080/FIT-940/, and record the results here.
- **Slack**: this sandbox cannot reach Slack, so the GM needs to post these results in the FIT-940 thread.
- **Asana T1–T4**: this sandbox cannot reach Asana, so the GM needs to update the tasks.

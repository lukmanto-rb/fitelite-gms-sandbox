# FIT-940 Classes today: test-environment release notes (T4)

PRD v1.0 (Notion 41901fb75e02811a841dced467709075) · Figma `avbkgNpFpt2rk4JGudCfdj` node 25-2 · Asana plan v2 · review pack: `docs/FIT-940-review.md`.

**Target:** http://localhost:8080/FIT-940/ only (test environment). **Not released to production.**

## Rework 2 (2026-11-16): heading "Classes today" above the number

**Feedback (Rian, final test):** "Use exactly the label 'Classes today' above the number."

**What we found (root cause):** The source code and the `npm run build:test-env` bundle at dd7cc8b already render the heading as an `<h2>` with the exact text `Classes today`, as the first element of the card, directly before the count, in every state. No CSS reorders or rewrites it. So the problem Rian saw **could not be reproduced in the code**. The gap was in verification:
- The existing AC-001 tests matched the heading by its accessible name. That proves it exists, but not that its raw text is exact or that it sits directly above the count on the home page.
- The in-browser check of http://localhost:8080/FIT-940/ was marked "Pending" in the T4 notes and was never done. Nobody confirmed that the page served on Rian's MacBook was this build. The most likely cause is an older or different build being served there, or Rian reading a different card's label (the cards above are "Today's opening hours" and "Next class"). **Please confirm with Rian what was on screen.**

**What changed:**
- No product code changed, because the heading text and position already matched PRD v1.0 (SCR-001, C01). Per the brief, all other copy, layout and behaviour is unchanged.
- New test `src/classesToday/ClassesTodayCard.heading.test.tsx` (6 tests) covers Normal, Zero, Loading, Error, the error-boundary fallback and the full home page. It checks that:
  - the card has exactly one heading, its raw text is exactly `Classes today` (literal, not taken from `COPY`), it has no `text-transform`, and it is the first element of the card;
  - in Normal and Zero, the count is the very next element after the heading, in DOM order, and no `order`, `*-reverse` or absolute positioning moves it.
- To check the test catches problems, we broke the code on purpose three times, then reverted each change. Changing the text to "Classes Today:" failed 6 of 6 tests. Moving the heading below the count failed 6 of 6. Adding `flex-direction: column-reverse` failed 3 of 6.
- Rebuilt with `npm run build:test-env`: the build succeeds, the bundle contains `MODE: "test-env"` and `heading:"Classes today"`, and assets load from relative paths.

**Test run (rework 2):**

```
> fitelite-gms@0.1.0 test
> vitest run

 Test Files  13 passed (13)
      Tests  80 passed (80)
```

**Evidence still needed (outside the sandbox):** the squad records the commit hash and CI link after pushing. Please hard-refresh http://localhost:8080/FIT-940/ and confirm the card reads "Classes today" above "3".

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

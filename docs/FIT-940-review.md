# FIT-940 Classes today: review pack (T3)

PRD v1.0 (Notion 41901fb75e02811a841dced467709075) · Figma `avbkgNpFpt2rk4JGudCfdj` node 25-2 · Asana plan v2.
Status: **awaiting review approval. Do not merge without approval (T3).**

## Test run

`npm test` on branch `squad/FIT-940-classes-today`, 2026-11-15: **11 files, 70 tests, all passed**. This includes the existing home-page suites (`HomePage.test.tsx`, `OpeningHoursCard.test.tsx`). `tsc -b` is clean, and `npm run build` and `npm run build:test-env` both succeed.

## Traceability: acceptance criteria

| AC | Automated test(s), all passing | Manual check |
|---|---|---|
| AC-001 heading + "Sample data" | `ClassesTodayCard.test.tsx` › AC-001 | T4 smoke |
| AC-002 normal → "3", no names | `ClassesTodayCard.test.tsx` › AC-002; `countClasses.test.ts` › normal counts 3, excludes adjacent days; `useClassesToday.test.tsx` › success(3) | T4: `?scenario=normal` |
| AC-003 zero → "0", "No classes today", "Sample data" | `ClassesTodayCard.test.tsx` › AC-003; `countClasses.test.ts` › zero counts 0; `useClassesToday.test.tsx` › success(0) | T4: `?scenario=zero` |
| AC-004 Loading, no count/Retry | `ClassesTodayCard.test.tsx` › AC-004; `useClassesToday.test.tsx` › starts in Loading synchronously | T4 |
| AC-005 Error copy, no count | `ClassesTodayCard.test.tsx` › AC-005; `useClassesToday.test.tsx` › loading → error | T4: `?scenario=error` |
| AC-006 repeated retry → one load → "3" | `ClassesTodayCard.test.tsx` › AC-006; `useClassesToday.test.tsx` › repeated retries start only one load | T4 |
| AC-007 failed retry → Error | `ClassesTodayCard.test.tsx` › AC-007; `useClassesToday.test.tsx` › failed retry returns to Error | T4 |
| AC-008 existing cards kept | `HomePage.classesToday.test.tsx` › order intact through load/failure/retry/success; thrown card error does not break page; existing `HomePage.test.tsx` unchanged and passing | T4 existing-card check |
| AC-009 sample, not live | `ClassesTodayCard.test.tsx` › AC-009; `countClasses.test.ts` › no live schedule import; `HomePage.classesToday.test.tsx` › normal sample by default | — |
| AC-010 320 px, keyboard, screen reader | `ClassesTodayCard.test.tsx` › polite live region; native tabbable Retry keeping focus in card; visible focus style; 16 px padding below 768 px | **Pending:** browser check at 320 px plus keyboard and screen reader across all four states (see below) |

Supporting coverage: NFR-007 `formatClassCount`; NFR-008 analytics payloads (`analytics.test.ts`); NFR-002 no personal data (`sampleClasses.test.ts`); OQ-001 no status filter; OQ-003 no click or navigation.

## Figma frame comparison

| Frame | Implementation |
|---|---|
| Classes today / Normal (26:3) | Heading 16 px → count "3" 32 px bold → "Sample data" 12 px muted. No supporting sentence. |
| Classes today / Zero (26:8) | Heading → "0" 32 px → "No classes today" 14 px muted → "Sample data". |
| Classes today / Loading (26:14) | Heading → "Loading classes…" 14 px muted → "Sample data". No count, no button. |
| Classes today / Error (26:19) | Heading → "Unable to load classes." 14 px error tone → "Try again" primary button → "Sample data" last. |

Every frame uses a left-aligned column with 24 px padding and 8 px gaps, switching to 16 px padding and full column width below 768 px. The 32 px count is asserted as the largest text.

## Review findings and resolution

1. **Fixed: the scenario selector could not be turned on in the test environment.** `VITE_ENABLE_SCENARIO_SELECTOR` was set nowhere, so the localhost release could only show the normal scenario. Added `.env.test-env` and `npm run build:test-env` (`vite build --mode test-env`). The plain `npm run build` keeps the selector off, as tested in `testEnvBuild.test.ts`. **The test environment must be built with `npm run build:test-env`.** After that, use `/FIT-940/?scenario=normal|zero|error`.
2. No other defects found in data, count, state machine, card, error boundary or home-page placement.

## Open points (not decided here)

- Test-only scenario selector: not yet confirmed by Rian. It is hidden, URL-only, and enabled only in the test-env build.
- OQ-001 (cancelled classes), OQ-002 (time zone and rollover), OQ-003 (card navigation): still open. The code adds no status filter, uses the device-local date on page entry as the test D, and has no navigation.
- Analytics: the app has no analytics mechanism. Events are built with only the enumerated properties but sent to a no-op sink. Nothing was installed.
- AC-010 manual evidence: no browser or screen reader is available in the build sandbox. Do the 320 px, keyboard and screen-reader check on the test release and record it here before approval.

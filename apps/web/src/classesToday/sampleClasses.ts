/**
 * FIT-940 "Classes today" sample data (PRD v1.0, BR-001 to BR-004, NFR-002).
 *
 * Fictional class occurrences only: no member, instructor, booking or contact data.
 * Records are placed relative to an injectable evaluated date D (D−1, D, D+1) and
 * carry local date-times without a time-zone offset (BR-002). Choosing D from the
 * gym's calendar is OQ-002 and is deliberately not decided here.
 */

export type SampleScenario = 'normal' | 'zero' | 'error';

export const SAMPLE_SCENARIOS: readonly SampleScenario[] = ['normal', 'zero', 'error'];

/** One class occurrence (BR-001). `startsAt` is a local `YYYY-MM-DDTHH:mm` string, no offset. */
export type SampleClass = {
  id: string;
  name: string;
  startsAt: string;
  status: 'Scheduled';
};

type Template = { name: string; dayOffset: -1 | 0 | 1; time: string };

const NORMAL: Template[] = [
  { name: 'Mobility', dayOffset: -1, time: '18:00' },
  { name: 'Yoga', dayOffset: 0, time: '09:00' },
  { name: 'Strength', dayOffset: 0, time: '12:00' },
  { name: 'Pilates', dayOffset: 0, time: '18:00' },
  { name: 'Cycling', dayOffset: 1, time: '09:00' },
];

const ZERO: Template[] = [
  { name: 'Mobility', dayOffset: -1, time: '18:00' },
  { name: 'Cycling', dayOffset: 1, time: '09:00' },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date of `date` as `YYYY-MM-DD` (no time-zone conversion). */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function build(templates: Template[], evaluatedDate: Date, prefix: string): SampleClass[] {
  return templates.map((t, i) => ({
    id: `${prefix}-${i + 1}`,
    name: t.name,
    startsAt: `${toDateKey(addDays(evaluatedDate, t.dayOffset))}T${t.time}`,
    status: 'Scheduled',
  }));
}

/** Normal scenario (BR-003): five Scheduled records, three on D. */
export function normalSample(evaluatedDate: Date): SampleClass[] {
  return build(NORMAL, evaluatedDate, 'normal');
}

/** Zero scenario (BR-004): two Scheduled records on D−1 and D+1 only. */
export function zeroSample(evaluatedDate: Date): SampleClass[] {
  return build(ZERO, evaluatedDate, 'zero');
}

export class SampleLoadError extends Error {
  constructor() {
    super('Sample data load failed');
    this.name = 'SampleLoadError';
  }
}

export type LoadOptions = {
  /** Simulated latency so Loading is visible in the test environment. */
  delayMs?: number;
};

export const DEFAULT_LOAD_DELAY_MS = 600;

/**
 * Loads the records for a sample scenario. The "error" scenario always rejects,
 * so a retry in that scenario fails again (AC-007).
 */
export function loadSampleClasses(
  scenario: SampleScenario,
  evaluatedDate: Date,
  { delayMs = DEFAULT_LOAD_DELAY_MS }: LoadOptions = {},
): Promise<SampleClass[]> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (scenario === 'normal') resolve(normalSample(evaluatedDate));
      else if (scenario === 'zero') resolve(zeroSample(evaluatedDate));
      else reject(new SampleLoadError());
    }, delayMs);
  });
}

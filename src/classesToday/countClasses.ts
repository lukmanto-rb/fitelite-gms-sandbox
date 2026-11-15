import { toDateKey, type SampleClass } from './sampleClasses';

/**
 * FR-003: count each record once when its scheduled start date equals D.
 * No status filtering: the cancelled-class policy is open (OQ-001).
 */
export function countClassesOn(records: readonly SampleClass[], evaluatedDate: Date): number {
  const day = toDateKey(evaluatedDate);
  const seen = new Set<string>();
  for (const r of records) {
    if (r.startsAt.slice(0, 10) === day) seen.add(r.id);
  }
  return seen.size;
}

/**
 * NFR-007: non-negative integer, no decimal places. The app has no existing
 * number-formatting helper, so this is the single place to align with one later.
 */
export function formatClassCount(count: number): string {
  const safe = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(safe);
}

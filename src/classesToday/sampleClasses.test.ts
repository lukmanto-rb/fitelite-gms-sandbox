import {
  loadSampleClasses,
  normalSample,
  SampleLoadError,
  toDateKey,
  zeroSample,
} from './sampleClasses';

const D = new Date(2026, 10, 16); // evaluated date D
const ALLOWED_KEYS = ['id', 'name', 'startsAt', 'status'];

describe('sample class records (BR-001 to BR-004, NFR-002)', () => {
  it('normal sample has the five BR-003 records relative to D', () => {
    expect(normalSample(D).map(({ name, startsAt, status }) => [name, startsAt, status])).toEqual([
      ['Mobility', '2026-11-15T18:00', 'Scheduled'],
      ['Yoga', '2026-11-16T09:00', 'Scheduled'],
      ['Strength', '2026-11-16T12:00', 'Scheduled'],
      ['Pilates', '2026-11-16T18:00', 'Scheduled'],
      ['Cycling', '2026-11-17T09:00', 'Scheduled'],
    ]);
  });

  it('zero sample has only the two adjacent-day BR-004 records', () => {
    expect(zeroSample(D).map(({ name, startsAt, status }) => [name, startsAt, status])).toEqual([
      ['Mobility', '2026-11-15T18:00', 'Scheduled'],
      ['Cycling', '2026-11-17T09:00', 'Scheduled'],
    ]);
  });

  it('places records relative to any injected D, across month and year ends', () => {
    const newYear = normalSample(new Date(2027, 0, 1));
    expect(newYear[0].startsAt).toBe('2026-12-31T18:00');
    expect(newYear[4].startsAt).toBe('2027-01-02T09:00');
  });

  it('records carry no time-zone offset (BR-002)', () => {
    for (const r of [...normalSample(D), ...zeroSample(D)]) {
      expect(r.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    }
  });

  it('records contain no member, instructor, booking or contact data', () => {
    for (const r of [...normalSample(D), ...zeroSample(D)]) {
      expect(Object.keys(r).sort()).toEqual([...ALLOWED_KEYS].sort());
      expect(JSON.stringify(r)).not.toMatch(/@|\+?\d{3}[ -]?\d{3}[ -]?\d{3,}|instructor|member/i);
    }
  });

  it('record ids are unique', () => {
    const ids = normalSample(D).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toDateKey uses the local calendar date', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('loadSampleClasses', () => {
  it('resolves the normal and zero scenarios and rejects the error scenario', async () => {
    await expect(loadSampleClasses('normal', D, { delayMs: 0 })).resolves.toHaveLength(5);
    await expect(loadSampleClasses('zero', D, { delayMs: 0 })).resolves.toHaveLength(2);
    await expect(loadSampleClasses('error', D, { delayMs: 0 })).rejects.toBeInstanceOf(
      SampleLoadError,
    );
  });

  it('waits for the simulated delay before resolving', async () => {
    vi.useFakeTimers();
    try {
      let done = false;
      const p = loadSampleClasses('normal', D, { delayMs: 500 }).then(() => (done = true));
      await vi.advanceTimersByTimeAsync(499);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await p;
      expect(done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

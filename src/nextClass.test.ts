import { formatStartTime, getNextClass } from './nextClass';
import type { GymClass } from './types';

const now = new Date('2026-11-13T12:00:00Z');
const cls = (id: string, startTime: string): GymClass => ({ id, name: id, startTime, studio: 'S' });

describe('getNextClass', () => {
  it('returns the class with the earliest future start time', () => {
    const classes = [
      cls('later', '2026-11-13T18:00:00Z'),
      cls('soonest', '2026-11-13T13:00:00Z'),
      cls('tomorrow', '2026-11-14T09:00:00Z'),
    ];
    expect(getNextClass(classes, now)?.id).toBe('soonest');
  });

  it('ignores classes that have already started', () => {
    const classes = [cls('past', '2026-11-13T11:00:00Z'), cls('now', '2026-11-13T12:00:00Z'), cls('future', '2026-11-13T19:00:00Z')];
    expect(getNextClass(classes, now)?.id).toBe('future');
  });

  it('returns null when there are no classes', () => {
    expect(getNextClass([], now)).toBeNull();
  });

  it('returns null when all classes are in the past', () => {
    expect(getNextClass([cls('past', '2026-11-12T10:00:00Z')], now)).toBeNull();
  });

  it('skips classes with an invalid start time', () => {
    expect(getNextClass([cls('bad', 'not a date'), cls('ok', '2026-11-13T15:00:00Z')], now)?.id).toBe('ok');
  });
});

describe('formatStartTime', () => {
  it('formats the start time (tests run in UTC)', () => {
    expect(formatStartTime('2026-11-13T18:30:00Z')).toBe('Fri 13 Nov, 18:30');
  });
});

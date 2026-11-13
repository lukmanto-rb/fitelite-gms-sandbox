import type { GymClass } from '../types';

const HOUR = 60 * 60 * 1000;

/**
 * Sample data only — not connected to real gym or member data.
 * Start times are relative to `now` so the demo always has upcoming classes.
 */
export function getSampleClasses(now: Date = new Date()): GymClass[] {
  const at = (hoursFromNow: number) => new Date(now.getTime() + hoursFromNow * HOUR).toISOString();
  return [
    { id: 'c1', name: 'Morning Yoga', startTime: at(-2), studio: 'Studio A' },
    { id: 'c2', name: 'HIIT Blast', startTime: at(5), studio: 'Studio B' },
    { id: 'c3', name: 'Spin Class', startTime: at(2), studio: 'Cycle Studio' },
    { id: 'c4', name: 'Pilates', startTime: at(26), studio: 'Studio A' },
  ];
}

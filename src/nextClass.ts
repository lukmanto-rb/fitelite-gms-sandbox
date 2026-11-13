import type { GymClass } from './types';

/**
 * Returns the class with the earliest start time that is still in the future
 * relative to `now`, or `null` if there is none.
 */
export function getNextClass(classes: readonly GymClass[], now: Date): GymClass | null {
  let next: GymClass | null = null;
  let nextTime = Infinity;
  for (const gymClass of classes) {
    const time = Date.parse(gymClass.startTime);
    if (Number.isNaN(time) || time <= now.getTime()) continue;
    if (time < nextTime) {
      next = gymClass;
      nextTime = time;
    }
  }
  return next;
}

/**
 * Placeholder start-time format (e.g. "Fri 13 Nov, 18:30") in the viewer's
 * local time zone. The final format is an open product question.
 */
export function formatStartTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

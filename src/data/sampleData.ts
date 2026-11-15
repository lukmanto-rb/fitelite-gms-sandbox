export type DayHours = { open: string; close: string } | null;

/** Weekly opening hours, indexed by Date.getDay() (0 = Sunday). null = closed. */
export const openingHours: DayHours[] = [
  null, // Sunday
  { open: '06:00', close: '22:00' }, // Monday
  { open: '06:00', close: '22:00' }, // Tuesday
  { open: '06:00', close: '22:00' }, // Wednesday
  { open: '06:00', close: '22:00' }, // Thursday
  { open: '06:00', close: '21:00' }, // Friday
  { open: '08:00', close: '18:00' }, // Saturday
];

export const nextClass = {
  name: 'Spin',
  time: '18:30',
  instructor: 'Alex',
};

import { openingHours as defaultHours, type DayHours } from '../data/sampleData';

type Props = {
  date?: Date;
  hours?: DayHours[];
};

export function todaysHoursText(date: Date, hours: DayHours[]): string {
  const today = hours[date.getDay()];
  return today ? `${today.open}–${today.close}` : 'Closed today';
}

export default function OpeningHoursCard({ date = new Date(), hours = defaultHours }: Props) {
  return (
    <section className="card" aria-labelledby="opening-hours-title">
      <h2 id="opening-hours-title">Today's opening hours</h2>
      <p>{todaysHoursText(date, hours)}</p>
    </section>
  );
}

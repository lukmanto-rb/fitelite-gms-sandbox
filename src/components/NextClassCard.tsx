import type { GymClass } from '../types';
import { formatStartTime, getNextClass } from '../nextClass';

interface NextClassCardProps {
  classes: readonly GymClass[];
  now?: Date;
}

export function NextClassCard({ classes, now = new Date() }: NextClassCardProps) {
  const next = getNextClass(classes, now);

  return (
    <section className="next-class-card" aria-labelledby="next-class-heading">
      <h2 id="next-class-heading">Next class</h2>
      {next ? (
        <dl>
          <dt>Class</dt>
          <dd data-testid="next-class-name">{next.name}</dd>
          <dt>Starts</dt>
          <dd data-testid="next-class-start">
            <time dateTime={next.startTime}>{formatStartTime(next.startTime)}</time>
          </dd>
          <dt>Studio</dt>
          <dd data-testid="next-class-studio">{next.studio}</dd>
        </dl>
      ) : (
        <p data-testid="next-class-empty">No upcoming classes.</p>
      )}
    </section>
  );
}

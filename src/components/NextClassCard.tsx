import { nextClass } from '../data/sampleData';

export default function NextClassCard() {
  return (
    <section className="card" aria-labelledby="next-class-title">
      <h2 id="next-class-title">Next class</h2>
      <p>
        {nextClass.name} at {nextClass.time} with {nextClass.instructor}
      </p>
    </section>
  );
}

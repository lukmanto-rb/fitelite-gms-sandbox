import { NextClassCard } from './components/NextClassCard';
import { getSampleClasses } from './data/sampleClasses';

export function App() {
  return (
    <main>
      <h1>Fitelite GMS</h1>
      <NextClassCard classes={getSampleClasses()} />
    </main>
  );
}

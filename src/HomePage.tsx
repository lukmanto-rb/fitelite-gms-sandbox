import NextClassCard from './components/NextClassCard';
import OpeningHoursCard from './components/OpeningHoursCard';
import ClassesTodayCard, { type ClassesTodayCardProps } from './classesToday/ClassesTodayCard';
import { isScenarioSelectorEnabled, resolveScenario } from './classesToday/scenarioSelector';

type Props = {
  /** Test seam for the Classes today card; the app passes nothing. */
  classesToday?: ClassesTodayCardProps;
};

export default function HomePage({ classesToday }: Props = {}) {
  // Test-environment-only scenario choice (open point for Rian); always "normal" otherwise.
  const scenario = resolveScenario(
    typeof window === 'undefined' ? '' : window.location.search,
    isScenarioSelectorEnabled(),
  );
  return (
    <main>
      <h1>Fitelite</h1>
      <OpeningHoursCard />
      <NextClassCard />
      <ClassesTodayCard scenario={scenario} {...classesToday} />
    </main>
  );
}

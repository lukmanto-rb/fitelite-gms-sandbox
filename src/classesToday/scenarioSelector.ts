import { SAMPLE_SCENARIOS, type SampleScenario } from './sampleClasses';

/**
 * TEST-ENVIRONMENT ONLY sample-scenario selector (open point for Rian: the PRD
 * does not say how a scenario is chosen). It has no visible UI: in the test
 * environment the scenario is read from the `?scenario=normal|zero|error` URL
 * parameter. It only works in a build made with `vite build --mode test-env`
 * (`npm run build:test-env`), where Vite sets import.meta.env.MODE to 'test-env'.
 * No .env file is needed. In every other build the card always uses the
 * normal sample.
 */
export const DEFAULT_SCENARIO: SampleScenario = 'normal';

export const TEST_ENV_MODE = 'test-env';

export function isScenarioSelectorEnabled(
  env: Record<string, unknown> = import.meta.env,
): boolean {
  return env.MODE === TEST_ENV_MODE;
}

export function resolveScenario(search: string, enabled: boolean): SampleScenario {
  if (!enabled) return DEFAULT_SCENARIO;
  const value = new URLSearchParams(search).get('scenario');
  return SAMPLE_SCENARIOS.find((s) => s === value) ?? DEFAULT_SCENARIO;
}

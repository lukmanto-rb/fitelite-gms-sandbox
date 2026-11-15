import { isScenarioSelectorEnabled, resolveScenario } from './scenarioSelector';

describe('test-environment scenario selector', () => {
  it('is off unless the build flag is exactly "true"', () => {
    expect(isScenarioSelectorEnabled({})).toBe(false);
    expect(isScenarioSelectorEnabled({ VITE_ENABLE_SCENARIO_SELECTOR: 'false' })).toBe(false);
    expect(isScenarioSelectorEnabled({ VITE_ENABLE_SCENARIO_SELECTOR: 'true' })).toBe(true);
  });

  it('is off in the default (unflagged) environment', () => {
    expect(isScenarioSelectorEnabled()).toBe(false);
  });

  it('ignores the URL and uses normal when disabled', () => {
    expect(resolveScenario('?scenario=error', false)).toBe('normal');
  });

  it('reads the scenario from the URL when enabled', () => {
    expect(resolveScenario('?scenario=normal', true)).toBe('normal');
    expect(resolveScenario('?scenario=zero', true)).toBe('zero');
    expect(resolveScenario('?scenario=error', true)).toBe('error');
  });

  it('falls back to normal for missing or unknown values', () => {
    expect(resolveScenario('', true)).toBe('normal');
    expect(resolveScenario('?scenario=live', true)).toBe('normal');
  });
});

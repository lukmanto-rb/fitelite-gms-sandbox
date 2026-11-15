import { loadEnv } from 'vite';
import pkg from '../../package.json';
import { isScenarioSelectorEnabled } from './scenarioSelector';

// Project root, relative to the test runner's working directory (the repo root).
const root = '.';

describe('test-environment build mode (scenario selector, open point for Rian)', () => {
  it('enables the selector only in the test-env build mode', () => {
    expect(isScenarioSelectorEnabled(loadEnv('test-env', root, 'VITE_'))).toBe(true);
  });

  it('keeps the selector off in the normal production and development builds', () => {
    expect(isScenarioSelectorEnabled(loadEnv('production', root, 'VITE_'))).toBe(false);
    expect(isScenarioSelectorEnabled(loadEnv('development', root, 'VITE_'))).toBe(false);
    expect(pkg.scripts.build).not.toMatch(/test-env/);
  });

  it('has a build:test-env script that uses the test-env mode', () => {
    expect(pkg.scripts['build:test-env']).toMatch(/vite build --mode test-env/);
  });
});

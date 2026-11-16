import { loadEnv } from 'vite';
import pkg from '../../package.json';
import { isScenarioSelectorEnabled } from './scenarioSelector';

// Project root, relative to the test runner's working directory (the repo root).
const root = '.';

// The env object Vite exposes as import.meta.env for a build mode: variables
// from any .env files plus MODE. No .env file is required.
const envForMode = (mode: string) => ({ ...loadEnv(mode, root, 'VITE_'), MODE: mode });

describe('test-environment build mode (scenario selector, open point for Rian)', () => {
  it('enables the selector only in the test-env build mode', () => {
    expect(isScenarioSelectorEnabled(envForMode('test-env'))).toBe(true);
  });

  it('keeps the selector off in the normal production and development builds', () => {
    expect(isScenarioSelectorEnabled(envForMode('production'))).toBe(false);
    expect(isScenarioSelectorEnabled(envForMode('development'))).toBe(false);
    expect(pkg.scripts.build).not.toMatch(/test-env/);
  });

  it('has a build:test-env script that uses the test-env mode', () => {
    expect(pkg.scripts['build:test-env']).toMatch(/vite build --mode test-env/);
  });
});

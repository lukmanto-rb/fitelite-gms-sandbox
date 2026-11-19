import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { DEFAULT_LOAD_DELAY_MS } from './classesToday/sampleClasses';

// FIT-940 T4 release smoke test: the whole app as built by `npm run build:test-env`
// (Vite MODE 'test-env', scenario selector on, open point for Rian), driven through
// the real sample loader and the `?scenario=` URL parameter, as on
// http://localhost:8080/FIT-940/?scenario=normal|zero|error.

const D = new Date(2026, 10, 16, 9, 0);
const EXISTING = ["Today's opening hours", 'Next class'];

const cardOrder = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
const count = () => screen.queryByTestId('classes-today-count');

function expectExistingCardsIntact() {
  expect(cardOrder()).toEqual([...EXISTING, 'Classes today']);
  expect(screen.getByText('06:00–22:00')).toBeInTheDocument();
  expect(screen.getByText('Spin at 18:30 with Alex')).toBeInTheDocument();
  expect(screen.getByText('Sample data')).toBeInTheDocument();
}

const finishLoad = () => act(() => vi.advanceTimersByTimeAsync(DEFAULT_LOAD_DELAY_MS));

function openAt(search: string) {
  window.history.replaceState(null, '', `/FIT-940/${search}`);
  render(<App />);
}

describe('FIT-940 test-environment release smoke (T4)', () => {
  beforeEach(() => {
    vi.stubEnv('MODE', 'test-env');
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] });
    vi.setSystemTime(D);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    window.history.replaceState(null, '', '/');
  });

  it('normal scenario: Loading, then "3" (AC-002), existing cards intact (AC-008)', async () => {
    openAt('?scenario=normal');
    expect(screen.getByText('Loading classes…')).toBeInTheDocument();
    expect(count()).toBeNull();
    expectExistingCardsIntact();

    await finishLoad();
    expect(count()).toHaveTextContent('3');
    expect(screen.queryByText('No classes today')).toBeNull();
    expectExistingCardsIntact();
  });

  it('zero scenario: "0" and "No classes today" (AC-003), existing cards intact', async () => {
    openAt('?scenario=zero');
    expectExistingCardsIntact();
    await finishLoad();
    expect(count()).toHaveTextContent('0');
    expect(screen.getByText('No classes today')).toBeInTheDocument();
    expectExistingCardsIntact();
  });

  it('error scenario: Error, repeated retry starts one load, failed retry returns to Error (AC-005/006/007, NFR-005)', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    openAt('?scenario=error');
    await finishLoad();
    expect(screen.getByText('Unable to load classes.')).toBeInTheDocument();
    expect(count()).toBeNull();
    expectExistingCardsIntact();

    const loadsBefore = setTimeoutSpy.mock.calls.filter(([, ms]) => ms === DEFAULT_LOAD_DELAY_MS).length;
    const retry = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(retry);
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(screen.getByText('Loading classes…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(count()).toBeNull();
    const loadsAfter = setTimeoutSpy.mock.calls.filter(([, ms]) => ms === DEFAULT_LOAD_DELAY_MS).length;
    expect(loadsAfter - loadsBefore).toBe(1);
    expectExistingCardsIntact();

    await finishLoad();
    expect(screen.getByText('Unable to load classes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(count()).toBeNull();
    expectExistingCardsIntact();
    setTimeoutSpy.mockRestore();
  });

  it('unknown scenario falls back to normal', async () => {
    openAt('?scenario=live');
    await finishLoad();
    expect(count()).toHaveTextContent('3');
  });
});

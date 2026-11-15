import { act, fireEvent, render, screen } from '@testing-library/react';
import HomePage from './HomePage';
import { normalSample, type SampleClass, type SampleScenario } from './classesToday/sampleClasses';

// Lets a test make the card throw during render (unexpected bug), to exercise the error boundary.
const failFormatting = vi.hoisted(() => ({ on: false }));
vi.mock('./classesToday/countClasses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./classesToday/countClasses')>();
  return {
    ...actual,
    formatClassCount: (n: number) => {
      if (failFormatting.on) throw new Error('card bug');
      return actual.formatClassCount(n);
    },
  };
});

const D = new Date(2026, 10, 16, 9, 0); // Monday

function controlledLoader() {
  const calls: { resolve: (v: SampleClass[]) => void; reject: (e: unknown) => void }[] = [];
  const load = vi.fn(
    (_s: SampleScenario, _d: Date) =>
      new Promise<SampleClass[]>((resolve, reject) => calls.push({ resolve, reject })),
  );
  return { load, calls };
}

/** Card headings in document order. */
const cardOrder = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

const EXISTING = ["Today's opening hours", 'Next class'];

function expectExistingCardsIntact() {
  expect(cardOrder()).toEqual([...EXISTING, 'Classes today']);
  expect(screen.getByText('06:00–22:00')).toBeInTheDocument();
  expect(screen.getByText('Spin at 18:30 with Alex')).toBeInTheDocument();
}

describe('HomePage with Classes today (AC-008, FR-008, NFR-005)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(D);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds the card after the existing cards, keeping them intact through load, failure, retry and success', async () => {
    const { load, calls } = controlledLoader();
    render(<HomePage classesToday={{ load }} />);

    // Loading
    expect(screen.getByText('Loading classes…')).toBeInTheDocument();
    expectExistingCardsIntact();

    // Failure
    await act(async () => calls[0].reject(new Error('x')));
    expect(screen.getByText('Unable to load classes.')).toBeInTheDocument();
    expectExistingCardsIntact();

    // Retry
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Loading classes…')).toBeInTheDocument();
    expectExistingCardsIntact();

    // Success
    await act(async () => calls[1].resolve(normalSample(D)));
    expect(screen.getByTestId('classes-today-count')).toHaveTextContent('3');
    expectExistingCardsIntact();
  });

  it('evaluates the sample against the date on page entry', async () => {
    const load = vi.fn(async (_s: SampleScenario, d: Date) => normalSample(d));
    render(<HomePage classesToday={{ load }} />);
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(load.mock.calls[0][1].toDateString()).toBe(D.toDateString());
  });

  it('a card that throws while rendering does not break the rest of the page', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    failFormatting.on = true;
    try {
      const load = vi.fn(async (_s: SampleScenario, d: Date) => normalSample(d));
      render(<HomePage classesToday={{ load }} />);
      expect(await screen.findByText('Unable to load classes.')).toBeInTheDocument();
      expectExistingCardsIntact();

      failFormatting.on = false;
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('3')).toBeInTheDocument();
      expectExistingCardsIntact();
    } finally {
      failFormatting.on = false;
      spy.mockRestore();
    }
  });

  it('uses the normal sample by default (scenario selector off), not live data', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] });
    vi.setSystemTime(D);
    render(<HomePage />);
    expect(screen.getByText('Loading classes…')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByTestId('classes-today-count')).toHaveTextContent('3');
    expect(screen.getByText('Sample data')).toBeInTheDocument();
    expectExistingCardsIntact();
  });
});

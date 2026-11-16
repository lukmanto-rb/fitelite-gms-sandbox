import { act, render, screen } from '@testing-library/react';
import ClassesTodayCard, { ClassesTodayErrorBoundary } from './ClassesTodayCard';
import { normalSample, zeroSample, type SampleClass, type SampleScenario } from './sampleClasses';
import HomePage from '../HomePage';

/*
 * FIT-940 rework 2 (Rian's final test): "Use exactly the label 'Classes today' above the number."
 * PRD v1.0 SCR-001: heading first, count second; C01 reads exactly "Classes today" in every state.
 * The expected text is a literal on purpose, so changing COPY.heading also fails these tests.
 */
const EXACT_HEADING = 'Classes today';
const D = new Date(2026, 10, 16);

const card = () => screen.getByTestId('classes-today-card');

function controlledLoader() {
  const calls: { resolve: (v: SampleClass[]) => void; reject: (e: unknown) => void }[] = [];
  const load = vi.fn(
    (_s: SampleScenario, _d: Date) =>
      new Promise<SampleClass[]>((resolve, reject) => calls.push({ resolve, reject })),
  );
  return { load, calls };
}

/** The card's only heading, and it reads exactly "Classes today" (same case, no extra words or punctuation). */
function expectExactHeading(): HTMLElement {
  const headings = card().querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
  expect(headings).toHaveLength(1);
  const heading = headings[0] as HTMLElement;
  expect(heading.textContent).toBe(EXACT_HEADING);
  expect(heading.childElementCount).toBe(0);
  // The heading is the first thing in the card.
  expect(card().firstElementChild).toBe(heading);
  // Nothing visually rewrites or hides the text.
  const style = getComputedStyle(heading);
  expect(['', 'none']).toContain(style.textTransform);
  expect(style.display).not.toBe('none');
  expect(style.visibility).not.toBe('hidden');
  expect(heading).toHaveAccessibleName(EXACT_HEADING);
  return heading;
}

/** Heading is placed directly above the count: in DOM order, with no other content between them. */
function expectHeadingDirectlyAboveCount(expectedCount: string) {
  const heading = expectExactHeading();
  const count = screen.getByTestId('classes-today-count');
  expect(count.textContent).toBe(expectedCount);
  expect(heading.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  // The count is the first element after the heading (heading's next sibling, or its first child).
  const next = heading.nextElementSibling as HTMLElement;
  expect(next === count || next.firstElementChild === count).toBe(true);

  // No CSS reorders the column or moves the count above the heading.
  for (const el of [card(), next, heading, count]) {
    const s = getComputedStyle(el);
    expect(s.flexDirection).not.toMatch(/reverse/);
    expect(['', '0']).toContain(s.order);
    expect(['', 'static', 'relative']).toContain(s.position);
  }
}

describe('FIT-940 heading: exactly "Classes today", above the count', () => {
  it('Normal: heading is exactly "Classes today" and sits directly above "3"', async () => {
    render(<ClassesTodayCard evaluatedDate={D} load={async (_s, d) => normalSample(d)} />);
    await screen.findByTestId('classes-today-count');
    expectHeadingDirectlyAboveCount('3');
  });

  it('Zero: heading is exactly "Classes today" and sits directly above "0"', async () => {
    render(
      <ClassesTodayCard scenario="zero" evaluatedDate={D} load={async (_s, d) => zeroSample(d)} />,
    );
    await screen.findByTestId('classes-today-count');
    expectHeadingDirectlyAboveCount('0');
  });

  it('Loading: heading is exactly "Classes today"', () => {
    const { load } = controlledLoader();
    render(<ClassesTodayCard evaluatedDate={D} load={load} />);
    expect(screen.getByText('Loading classes…')).toBeInTheDocument();
    expectExactHeading();
  });

  it('Error: heading is exactly "Classes today"', async () => {
    const { load, calls } = controlledLoader();
    render(<ClassesTodayCard evaluatedDate={D} load={load} />);
    await act(async () => calls[0].reject(new Error('x')));
    expect(screen.getByText('Unable to load classes.')).toBeInTheDocument();
    expectExactHeading();
  });

  it('Error-boundary fallback: heading is exactly "Classes today"', () => {
    const Boom = () => {
      throw new Error('card bug');
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ClassesTodayErrorBoundary>{() => <Boom />}</ClassesTodayErrorBoundary>);
    spy.mockRestore();
    expect(screen.getByText('Unable to load classes.')).toBeInTheDocument();
    expectExactHeading();
  });

  it('On the home page: the card heading is exactly "Classes today" and sits directly above "3"', async () => {
    render(
      <HomePage classesToday={{ evaluatedDate: D, load: async (_s, d) => normalSample(d) }} />,
    );
    await screen.findByTestId('classes-today-count');
    expectHeadingDirectlyAboveCount('3');
  });
});

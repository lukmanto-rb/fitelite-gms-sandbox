import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ClassesTodayCard, {
  ClassesTodayCardContent,
  ClassesTodayErrorBoundary,
  COPY,
  TYPE_SCALE,
} from './ClassesTodayCard';
import { normalSample, zeroSample, type SampleClass, type SampleScenario } from './sampleClasses';
import type { ClassesTodayEvent } from './analytics';


// Component CSS is injected by Vitest (test.css); read it back to assert layout rules.
const cardCssText = () =>
  Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .find((t) => t.includes('.classes-today-card')) ?? '';

const D = new Date(2026, 10, 16);

function controlledLoader() {
  const calls: { resolve: (v: SampleClass[]) => void; reject: (e: unknown) => void }[] = [];
  const load = vi.fn(
    (_s: SampleScenario, _d: Date) =>
      new Promise<SampleClass[]>((resolve, reject) => calls.push({ resolve, reject })),
  );
  return { load, calls };
}

const card = () => screen.getByTestId('classes-today-card');
const count = () => screen.queryByTestId('classes-today-count');
const retryButton = () => screen.queryByRole('button', { name: COPY.retry });
const fontPx = (el: HTMLElement) => parseFloat(el.style.fontSize);

/** Order of the visible text blocks in the card, top to bottom. */
const textOrder = () =>
  Array.from(card().querySelectorAll('h2, p, button')).map((el) => el.textContent);

async function renderInError() {
  const { load, calls } = controlledLoader();
  const events: ClassesTodayEvent[] = [];
  render(<ClassesTodayCard evaluatedDate={D} load={load} analytics={(e) => events.push(e)} />);
  await act(async () => calls[0].reject(new Error('x')));
  return { load, calls, events };
}

describe('ClassesTodayCard', () => {
  it('AC-001: heading "Classes today" and "Sample data" label', async () => {
    render(<ClassesTodayCard evaluatedDate={D} load={async (_s, d) => normalSample(d)} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Classes today' })).toBeInTheDocument();
    expect(screen.getByText('Sample data')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Classes today' })).toBe(card());
    await screen.findByText('3');
  });

  it('AC-002: Normal shows "3", no supporting sentence and no class names', async () => {
    render(<ClassesTodayCard evaluatedDate={D} load={async (_s, d) => normalSample(d)} />);
    expect(await screen.findByText('3')).toBe(count());
    expect(textOrder()).toEqual(['Classes today', '3', 'Sample data']);
    for (const name of ['Mobility', 'Yoga', 'Strength', 'Pilates', 'Cycling']) {
      expect(card()).not.toHaveTextContent(name);
    }
    expect(retryButton()).not.toBeInTheDocument();
  });

  it('AC-003: Zero shows "0", "No classes today" and "Sample data"', async () => {
    render(
      <ClassesTodayCard scenario="zero" evaluatedDate={D} load={async (_s, d) => zeroSample(d)} />,
    );
    expect(await screen.findByText('0')).toBe(count());
    expect(textOrder()).toEqual(['Classes today', '0', 'No classes today', 'Sample data']);
    expect(card()).not.toHaveTextContent(/Mobility|Cycling/);
  });

  it('AC-004: Loading shows "Loading classes…" and "Sample data", no count or Retry', () => {
    const { load } = controlledLoader();
    render(<ClassesTodayCard evaluatedDate={D} load={load} />);
    expect(textOrder()).toEqual(['Classes today', 'Loading classes…', 'Sample data']);
    expect(count()).not.toBeInTheDocument();
    expect(card()).not.toHaveTextContent(/\d/);
    expect(retryButton()).not.toBeInTheDocument();
  });

  it('AC-005: Error shows "Unable to load classes.", "Try again" and "Sample data", no count', async () => {
    await renderInError();
    expect(textOrder()).toEqual([
      'Classes today',
      'Unable to load classes.',
      'Try again',
      'Sample data',
    ]);
    expect(count()).not.toBeInTheDocument();
    expect(card()).not.toHaveTextContent(/\d/);
  });

  it('AC-006: repeated "Try again" starts one load, shows Loading, then "3"', async () => {
    const { load, calls, events } = await renderInError();
    const button = retryButton()!;
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Loading classes…')).toBeInTheDocument();
    expect(retryButton()).not.toBeInTheDocument();
    expect(count()).not.toBeInTheDocument();
    expect(events.filter((e) => e.name === 'classes_today_retry_selected')).toHaveLength(1);

    await act(async () => calls[1].resolve(normalSample(D)));
    expect(count()).toHaveTextContent('3');
  });

  it('AC-007: a failed retry returns to Error with "Try again" and no count', async () => {
    const { calls } = await renderInError();
    fireEvent.click(retryButton()!);
    await act(async () => calls[1].reject(new Error('x')));
    expect(screen.getByText('Unable to load classes.')).toBeInTheDocument();
    expect(retryButton()).toBeEnabled();
    expect(count()).not.toBeInTheDocument();
  });

  it('AC-009: the default loader uses the sample scenario, with "Sample data" visible', async () => {
    vi.useFakeTimers();
    try {
      render(<ClassesTodayCard scenario="normal" evaluatedDate={D} />);
      expect(screen.getByText('Loading classes…')).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(count()).toHaveTextContent('3');
      expect(screen.getByText('Sample data')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts one initial load under StrictMode', () => {
    const { load } = controlledLoader();
    render(
      <StrictMode>
        <ClassesTodayCard evaluatedDate={D} load={load} />
      </StrictMode>,
    );
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('has no click or navigation (OQ-003)', async () => {
    render(<ClassesTodayCard evaluatedDate={D} load={async (_s, d) => normalSample(d)} />);
    await screen.findByText('3');
    expect(within(card()).queryByRole('link')).not.toBeInTheDocument();
    expect(within(card()).queryByRole('button')).not.toBeInTheDocument();
  });

  describe('layout and type scale', () => {
    it('the 32 px count is the largest text in Normal and Zero', async () => {
      const { unmount } = render(
        <ClassesTodayCard evaluatedDate={D} load={async (_s, d) => normalSample(d)} />,
      );
      await screen.findByText('3');
      const sizes = () =>
        Array.from(card().querySelectorAll<HTMLElement>('h2, p')).map((el) => fontPx(el));
      expect(fontPx(count()!)).toBe(32);
      expect(Math.max(...sizes())).toBe(32);
      expect(sizes().filter((s) => s === 32)).toHaveLength(1);
      unmount();

      render(<ClassesTodayCard evaluatedDate={D} load={async (_s, d) => zeroSample(d)} />);
      await screen.findByText('0');
      expect(fontPx(screen.getByRole('heading'))).toBe(TYPE_SCALE.heading);
      expect(fontPx(screen.getByText('No classes today'))).toBe(TYPE_SCALE.supporting);
      expect(fontPx(screen.getByText('Sample data'))).toBe(TYPE_SCALE.source);
      expect(sizes().filter((s) => s === 32)).toHaveLength(1);
    });

    it('uses 24 px padding and 8 px gaps, and 16 px padding below 768 px', () => {
      const css = cardCssText().replace(/\s+/g, ' ');
      expect(css).toMatch(/\.classes-today-card \{[^}]*gap: 8px;[^}]*padding: 24px;/);
      expect(css).toMatch(
        /@media \(max-width: 767\.98px\) \{ \.classes-today-card \{ padding: 16px; width: 100%;/,
      );
      // Wrap rather than truncate; no fixed widths that could force horizontal scroll at 320 px.
      expect(css).toContain('overflow-wrap: anywhere');
      expect(css).not.toMatch(/text-overflow|white-space: nowrap|(?<!max-)width: \d+px/);
    });

    it('Retry has a visible keyboard focus style', () => {
      expect(cardCssText().replace(/\s+/g, ' ')).toMatch(
        /\.classes-today-card__retry:focus-visible \{ outline: 3px solid/,
      );
    });
  });

  describe('accessibility (AC-010 automated part)', () => {
    it('announces Loading and Error through a polite live region', async () => {
      const { load, calls } = controlledLoader();
      render(<ClassesTodayCard evaluatedDate={D} load={load} />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveTextContent('Loading classes…');
      await act(async () => calls[0].reject(new Error('x')));
      // Same live-region node, so assistive tech announces the change.
      expect(screen.getByRole('status')).toBe(status);
      expect(status).toHaveTextContent('Unable to load classes.');
      fireEvent.click(retryButton()!);
      expect(status).toHaveTextContent('Loading classes…');
    });

    it('Retry is a native, tabbable button that keeps focus inside the card', async () => {
      const { calls } = await renderInError();
      const button = retryButton()!;
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).not.toHaveAttribute('tabindex');
      button.focus();
      expect(button).toHaveFocus();

      fireEvent.click(button);
      // Retry disappears; focus moves to the card heading instead of being lost.
      expect(screen.getByRole('heading', { name: 'Classes today' })).toHaveFocus();

      await act(async () => calls[1].reject(new Error('x')));
      await waitFor(() => expect(retryButton()).toHaveFocus());
    });
  });

  describe('error boundary (NFR-005)', () => {
    it('shows the Error state when the card throws, and Try again remounts it once', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let shouldThrow = true;
      const load = vi.fn(async (_s: SampleScenario, d: Date) => normalSample(d));
      function Child() {
        if (shouldThrow) throw new Error('render-time failure');
        return <ClassesTodayCardContent evaluatedDate={D} load={load} />;
      }
      try {
        render(<ClassesTodayErrorBoundary>{(attempt) => <Child key={attempt} />}</ClassesTodayErrorBoundary>);
        expect(textOrder()).toEqual([
          'Classes today',
          'Unable to load classes.',
          'Try again',
          'Sample data',
        ]);
        shouldThrow = false;
        const button = retryButton()!;
        fireEvent.click(button);
        fireEvent.click(button);
        expect(await screen.findByText('3')).toBeInTheDocument();
        expect(load).toHaveBeenCalledTimes(1);
      } finally {
        spy.mockRestore();
      }
    });
  });
});

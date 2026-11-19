import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { formatClassCount } from './countClasses';
import { useClassesToday, type UseClassesTodayOptions } from './useClassesToday';
import './ClassesTodayCard.css';

/** Exact PRD v1.0 copy (SCR-001-C01 to C05). */
export const COPY = {
  heading: 'Classes today',
  zero: 'No classes today',
  loading: 'Loading classes…',
  error: 'Unable to load classes.',
  retry: 'Try again',
  source: 'Sample data',
} as const;

/** Type scale from the Figma frames: the 32 px count is the largest element. */
export const TYPE_SCALE = {
  heading: 16,
  count: 32,
  supporting: 14,
  source: 12,
} as const;

const px = (n: number): CSSProperties => ({ fontSize: `${n}px` });

export type ClassesTodayCardProps = Partial<UseClassesTodayOptions>;

type FrameProps = {
  headingRef?: Ref<HTMLHeadingElement>;
  body: ReactNode;
  onRetry?: () => void;
  retryRef?: Ref<HTMLButtonElement>;
};

/** Shared layout: heading, count/status (polite live region), optional Retry, "Sample data" last. */
function CardFrame({ headingRef, body, onRetry, retryRef }: FrameProps) {
  return (
    <section
      className="card classes-today-card"
      aria-labelledby="classes-today-title"
      data-testid="classes-today-card"
    >
      <h2
        id="classes-today-title"
        ref={headingRef}
        tabIndex={-1}
        className="classes-today-card__heading"
        style={px(TYPE_SCALE.heading)}
      >
        {COPY.heading}
      </h2>
      <div className="classes-today-card__body" role="status" aria-live="polite" aria-atomic="true">
        {body}
      </div>
      {onRetry && (
        <button
          type="button"
          ref={retryRef}
          className="classes-today-card__retry"
          style={px(TYPE_SCALE.supporting)}
          onClick={onRetry}
        >
          {COPY.retry}
        </button>
      )}
      <p className="classes-today-card__source" style={px(TYPE_SCALE.source)}>
        {COPY.source}
      </p>
    </section>
  );
}

function Status({ text, tone }: { text: string; tone?: 'error' }) {
  return (
    <p
      className={`classes-today-card__status${tone ? ' classes-today-card__status--error' : ''}`}
      style={px(TYPE_SCALE.supporting)}
    >
      {text}
    </p>
  );
}

function ErrorBody() {
  return <Status text={COPY.error} tone="error" />;
}

/**
 * FIT-940 Classes today card. Informational only: no click or navigation (OQ-003).
 * Shows a count only after a successful sample-data load (BR-005).
 */
export function ClassesTodayCardContent({
  scenario = 'normal',
  evaluatedDate,
  load,
  analytics,
}: ClassesTodayCardProps) {
  // D is fixed on entry for this render cycle; the calendar rule itself is OQ-002.
  const [entryDate] = useState(() => evaluatedDate ?? new Date());
  const { state, retry } = useClassesToday({
    scenario,
    evaluatedDate: evaluatedDate ?? entryDate,
    load,
    analytics,
  });

  const headingRef = useRef<HTMLHeadingElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const retried = useRef(false);

  // Keep keyboard focus inside the card when Retry disappears, and return it to Retry on failure.
  useEffect(() => {
    if (!retried.current) return;
    if (state.status === 'error') retryRef.current?.focus();
  }, [state]);

  const onRetry = () => {
    retried.current = true;
    headingRef.current?.focus();
    retry();
  };

  let body: ReactNode;
  if (state.status === 'loading') body = <Status text={COPY.loading} />;
  else if (state.status === 'error') body = <ErrorBody />;
  else
    body = (
      <>
        <p
          className="classes-today-card__count"
          style={px(TYPE_SCALE.count)}
          data-testid="classes-today-count"
        >
          {formatClassCount(state.count)}
        </p>
        {state.count === 0 && <Status text={COPY.zero} />}
      </>
    );

  return (
    <CardFrame
      headingRef={headingRef}
      retryRef={retryRef}
      body={body}
      onRetry={state.status === 'error' ? onRetry : undefined}
    />
  );
}

type BoundaryState = { failed: boolean; attempt: number };

/**
 * Isolates unexpected card failures from the rest of the home page (NFR-005).
 * The fallback is the Error state; "Try again" remounts the card, which starts one new load.
 */
export class ClassesTodayErrorBoundary extends Component<{ children: (attempt: number) => ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { failed: true };
  }

  componentDidCatch() {
    // Deliberately no logging of error text (NFR-008: no free-text errors).
  }

  private reset = () => {
    this.setState((s) => (s.failed ? { failed: false, attempt: s.attempt + 1 } : s));
  };

  render() {
    if (this.state.failed) return <CardFrame body={<ErrorBody />} onRetry={this.reset} />;
    return this.props.children(this.state.attempt);
  }
}

export default function ClassesTodayCard(props: ClassesTodayCardProps) {
  return (
    <ClassesTodayErrorBoundary>
      {(attempt) => <ClassesTodayCardContent key={attempt} {...props} />}
    </ClassesTodayErrorBoundary>
  );
}

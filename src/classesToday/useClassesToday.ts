import { useCallback, useEffect, useRef, useState } from 'react';
import { countClassesOn } from './countClasses';
import { loadSampleClasses, type SampleClass, type SampleScenario } from './sampleClasses';
import {
  loadResultEvent,
  noopAnalytics,
  retrySelectedEvent,
  type AnalyticsSink,
} from './analytics';

/** Loading and error carry no count, so neither can be shown as 0 (BR-005). */
export type ClassesTodayState =
  | { status: 'loading' }
  | { status: 'success'; count: number }
  | { status: 'error' };

export type UseClassesTodayOptions = {
  scenario: SampleScenario;
  evaluatedDate: Date;
  /** Injectable for tests; defaults to the sample loader (sample data only, AC-009). */
  load?: (scenario: SampleScenario, evaluatedDate: Date) => Promise<SampleClass[]>;
  analytics?: AnalyticsSink;
};

export function useClassesToday({
  scenario,
  evaluatedDate,
  load = loadSampleClasses,
  analytics = noopAnalytics,
}: UseClassesTodayOptions): { state: ClassesTodayState; retry: () => void } {
  // Loading from the first render: never an unexplained blank card (NFR-004).
  const [state, setState] = useState<ClassesTodayState>({ status: 'loading' });
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const statusRef = useRef<ClassesTodayState['status']>('loading');
  const latest = useRef({ scenario, evaluatedDate, load, analytics });
  latest.current = { scenario, evaluatedDate, load, analytics };

  const apply = (next: ClassesTodayState) => {
    statusRef.current = next.status;
    setState(next);
  };

  const start = useCallback((loadType: 'initial' | 'retry') => {
    inFlight.current = true;
    const { scenario: s, evaluatedDate: d, load: l, analytics: a } = latest.current;
    let promise: Promise<SampleClass[]>;
    try {
      promise = l(s, d);
    } catch (e) {
      promise = Promise.reject(e);
    }
    promise.then(
      (records) => {
        inFlight.current = false;
        const count = countClassesOn(records, d);
        a(loadResultEvent(loadType, { ok: true, count }));
        if (mounted.current) apply({ status: 'success', count });
      },
      () => {
        inFlight.current = false;
        a(loadResultEvent(loadType, { ok: false }));
        if (mounted.current) apply({ status: 'error' });
      },
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Guard keeps StrictMode's double effect from starting a second load.
    if (!inFlight.current && statusRef.current === 'loading') start('initial');
    return () => {
      mounted.current = false;
    };
  }, [start]);

  const retry = useCallback(() => {
    // Only from Error, and only one load at a time (FR-007, AC-006).
    if (inFlight.current || statusRef.current !== 'error') return;
    latest.current.analytics(retrySelectedEvent());
    apply({ status: 'loading' });
    start('retry');
  }, [start]);

  return { state, retry };
}

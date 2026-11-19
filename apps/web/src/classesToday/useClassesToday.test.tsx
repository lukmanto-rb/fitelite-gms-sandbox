import { StrictMode, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useClassesToday, type UseClassesTodayOptions } from './useClassesToday';
import { normalSample, zeroSample, type SampleClass, type SampleScenario } from './sampleClasses';
import type { ClassesTodayEvent } from './analytics';

const D = new Date(2026, 10, 16);

function deferred() {
  let resolve!: (v: SampleClass[]) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<SampleClass[]>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function controlledLoader() {
  const calls: ReturnType<typeof deferred>[] = [];
  const load = vi.fn((_s: SampleScenario, _d: Date) => {
    const d = deferred();
    calls.push(d);
    return d.promise;
  });
  return { load, calls };
}

function setup(opts: Partial<UseClassesTodayOptions> = {}, wrapper?: (p: { children: ReactNode }) => ReactNode) {
  const events: ClassesTodayEvent[] = [];
  const hook = renderHook(
    () =>
      useClassesToday({
        scenario: 'normal',
        evaluatedDate: D,
        analytics: (e) => events.push(e),
        ...opts,
      }),
    { wrapper },
  );
  return { ...hook, events };
}

describe('useClassesToday state machine', () => {
  it('starts in Loading synchronously with no count (FR-005, NFR-004)', () => {
    const { load } = controlledLoader();
    const { result } = setup({ load });
    expect(result.current.state).toEqual({ status: 'loading' });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('normal', D);
  });

  it('loading → success(3) for the normal sample (AC-002)', async () => {
    const { result } = setup({ load: async (_s, d) => normalSample(d) });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'success', count: 3 }));
  });

  it('loading → success(0) for the zero sample (AC-003)', async () => {
    const { result } = setup({ scenario: 'zero', load: async (_s, d) => zeroSample(d) });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'success', count: 0 }));
  });

  it('loading → error with no count when the load fails (BR-005)', async () => {
    const { result } = setup({ load: () => Promise.reject(new Error('x')) });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'error' }));
    expect('count' in result.current.state).toBe(false);
  });

  it('treats a synchronously throwing loader as a failed load', async () => {
    const { result } = setup({
      load: () => {
        throw new Error('boom');
      },
    });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'error' }));
  });

  it('uses the default sample loader when none is injected (AC-009)', async () => {
    vi.useFakeTimers();
    try {
      const { result } = setup();
      expect(result.current.state.status).toBe('loading');
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(result.current.state).toEqual({ status: 'success', count: 3 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('repeated retries start only one load, show Loading, then 3 (AC-006)', async () => {
    const { load, calls } = controlledLoader();
    const { result, events } = setup({ load });
    await act(async () => calls[0].reject(new Error('x')));
    expect(result.current.state).toEqual({ status: 'error' });

    act(() => {
      result.current.retry();
      result.current.retry();
      result.current.retry();
    });
    expect(result.current.state).toEqual({ status: 'loading' });
    act(() => result.current.retry());
    expect(load).toHaveBeenCalledTimes(2);

    await act(async () => calls[1].resolve(normalSample(D)));
    expect(result.current.state).toEqual({ status: 'success', count: 3 });
    expect(events.filter((e) => e.name === 'classes_today_retry_selected')).toHaveLength(1);
  });

  it('a failed retry returns to Error and allows another retry (AC-007)', async () => {
    const { load, calls } = controlledLoader();
    const { result } = setup({ load });
    await act(async () => calls[0].reject(new Error('x')));
    act(() => result.current.retry());
    await act(async () => calls[1].reject(new Error('x')));
    expect(result.current.state).toEqual({ status: 'error' });
    act(() => result.current.retry());
    expect(load).toHaveBeenCalledTimes(3);
    expect(result.current.state).toEqual({ status: 'loading' });
  });

  it('ignores retry outside Error', async () => {
    const { load, calls } = controlledLoader();
    const { result } = setup({ load });
    act(() => result.current.retry()); // during initial load
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => calls[0].resolve(normalSample(D)));
    act(() => result.current.retry()); // after success
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.state).toEqual({ status: 'success', count: 3 });
  });

  it('starts only one initial load under StrictMode', async () => {
    const { load, calls } = controlledLoader();
    const { result } = setup({ load }, ({ children }) => <StrictMode>{children}</StrictMode>);
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => calls[0].resolve(normalSample(D)));
    expect(result.current.state).toEqual({ status: 'success', count: 3 });
  });

  it('does not update state after unmount', async () => {
    const { load, calls } = controlledLoader();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = setup({ load });
    unmount();
    await act(async () => calls[0].resolve(normalSample(D)));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('sends load-result and retry events with only enumerated properties (NFR-008)', async () => {
    const { load, calls } = controlledLoader();
    const { result, events } = setup({ load });
    await act(async () => calls[0].reject(new Error('secret token abc')));
    act(() => result.current.retry());
    await act(async () => calls[1].resolve(zeroSample(D)));
    expect(events).toEqual([
      { name: 'classes_today_load_result', properties: { result: 'error', count_band: 'unavailable', load_type: 'initial', data_source: 'sample' } },
      { name: 'classes_today_retry_selected', properties: { source_state: 'error', data_source: 'sample' } },
      { name: 'classes_today_load_result', properties: { result: 'success', count_band: 'zero', load_type: 'retry', data_source: 'sample' } },
    ]);
    expect(JSON.stringify(events)).not.toMatch(/secret|token|abc/);
  });
});

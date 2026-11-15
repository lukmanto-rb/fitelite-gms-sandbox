/**
 * NFR-008 analytics events for the Classes today card. Payloads carry only the
 * enumerated properties from the PRD: no class names, personal data, codes,
 * tokens or free-text errors.
 *
 * The app has no analytics mechanism yet, and adding one would need new
 * software, so the default sink sends nothing. Callers may pass a sink.
 */
export type LoadResultEvent = {
  name: 'classes_today_load_result';
  properties: {
    result: 'success' | 'error';
    count_band: 'zero' | 'positive' | 'unavailable';
    load_type: 'initial' | 'retry';
    data_source: 'sample';
  };
};

export type RetrySelectedEvent = {
  name: 'classes_today_retry_selected';
  properties: { source_state: 'error'; data_source: 'sample' };
};

export type ClassesTodayEvent = LoadResultEvent | RetrySelectedEvent;

export type AnalyticsSink = (event: ClassesTodayEvent) => void;

export const noopAnalytics: AnalyticsSink = () => {};

export function loadResultEvent(
  loadType: 'initial' | 'retry',
  outcome: { ok: true; count: number } | { ok: false },
): LoadResultEvent {
  return {
    name: 'classes_today_load_result',
    properties: {
      result: outcome.ok ? 'success' : 'error',
      count_band: !outcome.ok ? 'unavailable' : outcome.count > 0 ? 'positive' : 'zero',
      load_type: loadType,
      data_source: 'sample',
    },
  };
}

export function retrySelectedEvent(): RetrySelectedEvent {
  return {
    name: 'classes_today_retry_selected',
    properties: { source_state: 'error', data_source: 'sample' },
  };
}

import { loadResultEvent, retrySelectedEvent } from './analytics';

describe('analytics payloads (NFR-008)', () => {
  it('load result uses only the enumerated properties', () => {
    expect(loadResultEvent('initial', { ok: true, count: 3 })).toEqual({
      name: 'classes_today_load_result',
      properties: { result: 'success', count_band: 'positive', load_type: 'initial', data_source: 'sample' },
    });
    expect(loadResultEvent('initial', { ok: true, count: 0 }).properties.count_band).toBe('zero');
    expect(loadResultEvent('retry', { ok: false })).toEqual({
      name: 'classes_today_load_result',
      properties: { result: 'error', count_band: 'unavailable', load_type: 'retry', data_source: 'sample' },
    });
  });

  it('retry selected uses only the enumerated properties', () => {
    expect(retrySelectedEvent()).toEqual({
      name: 'classes_today_retry_selected',
      properties: { source_state: 'error', data_source: 'sample' },
    });
  });

  it('payloads never include the raw count, names or free text', () => {
    const json = JSON.stringify([
      loadResultEvent('initial', { ok: true, count: 3 }),
      loadResultEvent('retry', { ok: false }),
      retrySelectedEvent(),
    ]);
    expect(json).not.toMatch(/\b3\b|Yoga|Strength|Pilates|Mobility|Cycling|failed|Error/);
  });
});

import { createTrainersApi, newAttemptKey, TRAINERS_URL, validateTrainer } from './trainers';
import { validationFailedEvent } from './analytics';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('validateTrainer (FR-004, FR-005, BR-003)', () => {
  it('requires both values after trimming', () => {
    expect(validateTrainer('', '')).toEqual({ ok: false, errors: { name: 'required', speciality: 'required' } });
    expect(validateTrainer('  ', '\t')).toEqual({ ok: false, errors: { name: 'required', speciality: 'required' } });
  });

  it('counts characters as code points: 100 accepted, 101 rejected', () => {
    expect(validateTrainer('é'.repeat(100), 'Yoga').ok).toBe(true);
    expect(validateTrainer('😀'.repeat(100), 'Yoga').ok).toBe(true);
    expect(validateTrainer('é'.repeat(101), 'Yoga')).toEqual({ ok: false, errors: { name: 'too_long' } });
  });

  it('trims surrounding whitespace only, keeping case, punctuation and internal spaces', () => {
    expect(validateTrainer("  Anne-Marie  O'Neil ", ' HIIT & Core ')).toEqual({
      ok: true,
      name: "Anne-Marie  O'Neil",
      speciality: 'HIIT & Core',
    });
  });
});

describe('newAttemptKey', () => {
  it('matches the service key format and differs each time', () => {
    const a = newAttemptKey();
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(newAttemptKey()).not.toBe(a);
  });
});

describe('validationFailedEvent reasons', () => {
  it('maps field and reason', () => {
    expect(validationFailedEvent({ speciality: 'required' }).properties).toEqual({ field: 'speciality', reason: 'required' });
    expect(validationFailedEvent({ name: 'too_long' }).properties).toEqual({ field: 'name', reason: 'name_too_long' });
    expect(validationFailedEvent({ name: 'required', speciality: 'required' }).properties).toEqual({ field: 'both', reason: 'required' });
    expect(validationFailedEvent({ name: 'too_long', speciality: 'required' }).properties).toEqual({ field: 'both', reason: 'multiple' });
  });
});

describe('createTrainersApi (FR-006, FR-008)', () => {
  it('lists through the gateway with a relative path and the session cookie', async () => {
    const fetchImpl = vi.fn(async () => json(200, { trainers: [{ id: '1', name: 'A', speciality: 'B' }] }));
    const api = createTrainersApi(fetchImpl as unknown as typeof fetch);
    await expect(api.list()).resolves.toEqual([{ id: '1', name: 'A', speciality: 'B' }]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('api/trainers/trainers');
    expect(url).toBe(TRAINERS_URL);
    expect(url).not.toMatch(/^(\/|https?:)/);
    expect(init.credentials).toBe('same-origin');
  });

  it('treats non-OK, malformed and network failures as a load error (never an empty list)', async () => {
    for (const impl of [
      async () => json(401, { error: 'unauthenticated' }),
      async () => json(500, { error: 'service_error' }),
      async () => json(200, { nope: true }),
      async () => {
        throw new TypeError('Failed to fetch');
      },
    ]) {
      await expect(createTrainersApi(vi.fn(impl) as unknown as typeof fetch).list()).rejects.toBeTruthy();
    }
  });

  it('posts the trimmed values with the attempt key as Idempotency-Key', async () => {
    const fetchImpl = vi.fn(async () => json(201, { trainer: { id: '7', name: 'Sofia', speciality: 'Pilates' } }));
    const api = createTrainersApi(fetchImpl as unknown as typeof fetch);
    const res = await api.add({ name: 'Sofia', speciality: 'Pilates' }, 'key-12345678');
    expect(res).toEqual({ ok: true, trainer: { id: '7', name: 'Sofia', speciality: 'Pilates' } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('api/trainers/trainers');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe('key-12345678');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Sofia', speciality: 'Pilates' });
  });

  it('accepts the 200 replay of an earlier attempt as success', async () => {
    const api = createTrainersApi((async () => json(200, { trainer: { id: '7', name: 'S', speciality: 'P' } })) as unknown as typeof fetch);
    await expect(api.add({ name: 'S', speciality: 'P' }, 'key-12345678')).resolves.toMatchObject({ ok: true });
  });

  it('classifies failures without exposing details', async () => {
    const cases: [() => Promise<Response>, unknown][] = [
      [async () => { throw new TypeError('offline'); }, { ok: false, result: 'unconfirmed', category: 'connectivity' }],
      [async () => json(401, { error: 'unauthenticated' }), { ok: false, result: 'failure', category: 'permission' }],
      [async () => json(403, {}), { ok: false, result: 'failure', category: 'permission' }],
      [async () => json(500, { error: 'service_error' }), { ok: false, result: 'unconfirmed', category: 'service' }],
      [async () => json(502, {}), { ok: false, result: 'unconfirmed', category: 'service' }],
      [async () => json(400, { error: 'validation' }), { ok: false, result: 'failure', category: 'service' }],
      [async () => json(409, { error: 'idempotency_key_reused' }), { ok: false, result: 'failure', category: 'service' }],
      [async () => new Response('not json', { status: 201 }), { ok: false, result: 'unconfirmed', category: 'service' }],
    ];
    for (const [impl, expected] of cases) {
      const api = createTrainersApi(vi.fn(impl) as unknown as typeof fetch);
      expect(await api.add({ name: 'S', speciality: 'P' }, 'key-12345678')).toEqual(expected);
    }
  });

  it('gives up on a save that never answers and reports it as unconfirmed', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted')))),
      );
      const api = createTrainersApi(fetchImpl as unknown as typeof fetch, 1000);
      const pending = api.add({ name: 'S', speciality: 'P' }, 'key-12345678');
      await vi.advanceTimersByTimeAsync(1000);
      await expect(pending).resolves.toEqual({ ok: false, result: 'unconfirmed', category: 'connectivity' });
    } finally {
      vi.useRealTimers();
    }
  });
});

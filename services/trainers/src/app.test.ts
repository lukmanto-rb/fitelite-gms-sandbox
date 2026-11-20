import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, NAME_MAX, validateTrainer } from './app.js';
import { memoryDb, migrate, type Db } from './db.js';

// The gateway sets x-gms-workspace from the verified session (see services/gateway); here each
// "signed-in session" is a set of headers for one workspace.
const session = (ws: string) => ({ 'x-gms-workspace': ws, 'x-gms-user': 'staff-1' });
let keyN = 0;
const newKey = () => `attempt-${Date.now()}-${++keyN}`;

let db: Db;
let app: FastifyInstance;
beforeEach(async () => {
  db = await memoryDb();
  await migrate(db);
  app = await buildApp({ db });
});
afterEach(async () => {
  await app.close();
  await db.close();
});

const add = (body: unknown, opts: { ws?: string | null; key?: string | null } = {}) => {
  const headers: Record<string, string> = {};
  if (opts.ws !== null) Object.assign(headers, session(opts.ws ?? 'gym-a'));
  if (opts.key !== null) headers['idempotency-key'] = opts.key ?? newKey();
  return app.inject({ method: 'POST', url: '/trainers', headers, payload: body as object });
};
const list = async (ws = 'gym-a') => (await app.inject({ url: '/trainers', headers: session(ws) })).json().trainers;
const count = async () => Number((await db.query<{ n: string }>('SELECT count(*) AS n FROM trainers')).rows[0]!.n);

describe('trainers service', () => {
  it('migrates its database and answers its health check', async () => {
    const fresh = await memoryDb();
    expect(await migrate(fresh)).toEqual(['001_init.sql', '002_trainers.sql', '003_trainers_by_workspace.sql']);
    expect(await migrate(fresh)).toEqual([]);
    expect((await app.inject('/health')).json()).toEqual({ status: 'ok', service: 'trainers' });
    await fresh.close();
  });

  it('lists nothing for a workspace without trainers', async () => {
    expect(await list()).toEqual([]);
  });

  it('saves a trainer on the server and lists it (FR-006, FR-002)', async () => {
    const res = await add({ name: 'Alex Morgan', speciality: 'Strength training' });
    expect(res.statusCode).toBe(201);
    expect(res.json().trainer).toMatchObject({ name: 'Alex Morgan', speciality: 'Strength training' });
    expect(await list()).toEqual([res.json().trainer]);
  });

  describe('validation (AC-008, AC-009, AC-010)', () => {
    it.each([
      [{ name: '', speciality: '' }, { name: 'required', speciality: 'required' }],
      [{ name: '   ', speciality: 'Pilates' }, { name: 'required' }],
      [{ name: 'Sofia', speciality: ' \t\n ' }, { speciality: 'required' }],
      [{}, { name: 'required', speciality: 'required' }],
      [{ name: 42, speciality: ['x'] }, { name: 'required', speciality: 'required' }],
    ])('AC-008: rejects missing or whitespace-only values %j', async (body, fields) => {
      const res = await add(body);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'validation', fields });
      expect(await count()).toBe(0);
    });

    it('AC-009: rejects a name over 100 characters after trimming', async () => {
      const res = await add({ name: '  ' + 'a'.repeat(NAME_MAX + 1) + '  ', speciality: 'Yoga' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'validation', fields: { name: 'too_long' } });
      expect(await count()).toBe(0);
    });

    it('AC-010: keeps an exactly 100-character international name, its case and punctuation, without surrounding spaces', async () => {
      const base = "Zoë O'Brien-Łukasiewicz, Ñandú 山田 ";
      const name = (base.repeat(5)).slice(0, NAME_MAX);
      expect(Array.from(name)).toHaveLength(NAME_MAX);
      expect(name.trim()).toBe(name);
      const res = await add({ name: `   ${name}\t`, speciality: '  Pilates & Barre  ' });
      expect(res.statusCode).toBe(201);
      expect(res.json().trainer).toMatchObject({ name, speciality: 'Pilates & Barre' });
      expect((await list())[0]).toMatchObject({ name, speciality: 'Pilates & Barre' });
    });

    it('counts characters, not bytes: a 100-character name of accented and emoji characters passes', () => {
      expect(validateTrainer({ name: 'é'.repeat(100), speciality: 'x' }).ok).toBe(true);
      expect(validateTrainer({ name: '💪'.repeat(100), speciality: 'x' }).ok).toBe(true);
      expect(validateTrainer({ name: '💪'.repeat(101), speciality: 'x' })).toEqual({ ok: false, fields: { name: 'too_long' } });
    });

    it('refuses an add without an attempt key, and malformed bodies with codes only', async () => {
      expect((await add({ name: 'A', speciality: 'B' }, { key: null })).json()).toEqual({ error: 'idempotency_key_required' });
      const bad = await app.inject({ method: 'POST', url: '/trainers', headers: { ...session('gym-a'), 'idempotency-key': newKey(), 'content-type': 'application/json' }, payload: '{"name": "Sofia Garc' });
      expect(bad.statusCode).toBe(400);
      expect(bad.json()).toEqual({ error: 'bad_request' });
      expect(await count()).toBe(0);
    });
  });

  describe('one add attempt creates one trainer (FR-008, BR-004)', () => {
    it('AC-012: repeated submits of one attempt, even at the same time, create one record', async () => {
      const key = newKey();
      const body = { name: 'Sofia García', speciality: 'Pilates' };
      const results = await Promise.all(Array.from({ length: 5 }, () => add(body, { key })));
      const ids = new Set(results.map((r) => r.json().trainer.id));
      expect(ids.size).toBe(1);
      expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
      expect(results.every((r) => [200, 201].includes(r.statusCode))).toBe(true);
      expect(await count()).toBe(1);
    });

    it('AC-016: an unchanged retry after a lost confirmation returns the original record, not a second one', async () => {
      const key = newKey();
      const body = { name: 'Sofia García', speciality: 'Pilates' };
      const first = await add(body, { key }); // saved, but imagine the browser never got this answer
      const retry = await add({ name: ' Sofia García ', speciality: 'Pilates ' }, { key });
      expect(retry.statusCode).toBe(200);
      expect(retry.json().trainer).toEqual(first.json().trainer);
      expect(await list()).toEqual([first.json().trainer]);
    });

    it('refuses reusing an attempt key for different values', async () => {
      const key = newKey();
      await add({ name: 'Sofia García', speciality: 'Pilates' }, { key });
      const res = await add({ name: 'Someone Else', speciality: 'Yoga' }, { key });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'idempotency_key_reused' });
      expect(await count()).toBe(1);
    });

    it('OQ-004 undecided: a separate attempt with the same name and speciality is not blocked', async () => {
      const body = { name: 'Alex Morgan', speciality: 'Strength training' };
      expect((await add(body)).statusCode).toBe(201);
      expect((await add(body)).statusCode).toBe(201);
      expect(await list()).toHaveLength(2);
    });

    it('the same attempt key in another workspace is a different attempt', async () => {
      const key = newKey();
      await add({ name: 'A', speciality: 'B' }, { key, ws: 'gym-a' });
      expect((await add({ name: 'A', speciality: 'B' }, { key, ws: 'gym-b' })).statusCode).toBe(201);
    });
  });

  it('AC-017: saved trainers are still there after a fresh load, a restart and in a second signed-in session', async () => {
    const a = (await add({ name: 'Alex Morgan', speciality: 'Strength training' })).json().trainer;
    const s = (await add({ name: 'Sofia García', speciality: 'Pilates' })).json().trainer;
    expect(await list()).toEqual([a, s]); // refresh
    await app.close();
    app = await buildApp({ db }); // service restarted, same database
    const secondComputer = await app.inject({ url: '/trainers', headers: { 'x-gms-workspace': 'gym-a', 'x-gms-user': 'staff-2' } });
    expect(secondComputer.json().trainers).toEqual([a, s]);
  });

  it('OQ-003 undecided: the list order is stable (creation order), with no sort promised', async () => {
    for (const name of ['Zed', 'amy', 'Bob']) await add({ name, speciality: 'Yoga' });
    const first = (await list()).map((t: { name: string }) => t.name);
    expect(first).toEqual(['Zed', 'amy', 'Bob']);
    expect((await list()).map((t: { name: string }) => t.name)).toEqual(first);
  });

  describe('AC-018: signed-out and other-workspace access is denied (NFR-001, BR-006)', () => {
    it('refuses reads and saves without a workspace from the gateway, creating and showing nothing', async () => {
      await add({ name: 'Alex Morgan', speciality: 'Strength training' });
      for (const headers of [{}, { 'x-gms-workspace': '' }, { 'x-gms-workspace': 'gym a/../b' }]) {
        const read = await app.inject({ url: '/trainers', headers });
        expect(read.statusCode).toBe(401);
        expect(read.json()).toEqual({ error: 'unauthenticated' });
        expect(read.body).not.toContain('Alex');
        const save = await app.inject({ method: 'POST', url: '/trainers', headers: { ...headers, 'idempotency-key': newKey() }, payload: { name: 'Mallory', speciality: 'X' } });
        expect(save.statusCode).toBe(401);
      }
      const noSession = await add({ name: 'Mallory', speciality: 'X' }, { ws: null });
      expect(noSession.statusCode).toBe(401);
      expect(await count()).toBe(1);
    });

    it('shows each workspace only its own trainers and saves only into the caller\'s workspace', async () => {
      await add({ name: 'Alex Morgan', speciality: 'Strength training' }, { ws: 'gym-a' });
      await add({ name: 'Sofia García', speciality: 'Pilates' }, { ws: 'gym-b' });
      const other = await app.inject({ url: '/trainers', headers: session('gym-b') });
      expect(other.body).not.toContain('Alex');
      expect((await list('gym-a')).map((t: { name: string }) => t.name)).toEqual(['Alex Morgan']);
      expect((await list('gym-b')).map((t: { name: string }) => t.name)).toEqual(['Sofia García']);
      // A body naming another workspace is ignored: the workspace comes from the gateway only.
      await add({ name: 'Mallory', speciality: 'X', workspace_id: 'gym-a', workspace: 'gym-a' }, { ws: 'gym-b' });
      expect((await list('gym-a')).map((t: { name: string }) => t.name)).toEqual(['Alex Morgan']);
    });
  });

  it('NFR-002: error responses carry codes only, never trainer data or free-text details', async () => {
    const errors = [
      await add({ name: 'x'.repeat(101), speciality: 'Secret Speciality' }),
      await add({ name: 'Private Name', speciality: 'Yoga' }, { ws: null }),
      await app.inject({ url: '/nowhere', headers: session('gym-a') }),
    ];
    for (const res of errors) {
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.body).not.toMatch(/Secret|Private|xxxx|message|stack/i);
    }
    const broken = await buildApp({ db: { query: async () => { throw new Error('connection to db at 10.0.0.5 failed for Alex Morgan'); }, close: async () => {} } });
    const res = await broken.inject({ url: '/trainers', headers: session('gym-a') });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'service_error' });
    await broken.close();
  });
});

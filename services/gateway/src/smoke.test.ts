import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildGateway } from './app.js';
import { formatSmoke, runSmoke } from './smoke.js';

const secret = 'test-only-secret-0123456789abcdef-0123456789';

/** A stand-in trainers service: workspace-scoped, and idempotent unless told to be broken. */
function fakeTrainers(opts: { idempotent: boolean }): Promise<{ server: Server; url: string }> {
  const rows: { id: string; ws: string; key: string; name: string; speciality: string }[] = [];
  const server = createServer((req, res) => {
    const ws = req.headers['x-gms-workspace'] as string | undefined;
    const send = (status: number, body: unknown) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    if (req.url === '/health') return send(200, { status: 'ok' });
    if (!ws) return send(401, { error: 'unauthenticated' });
    if (req.method === 'GET') return send(200, { trainers: rows.filter((r) => r.ws === ws).map(({ id, name, speciality }) => ({ id, name, speciality })) });
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const { name, speciality } = JSON.parse(raw);
      const key = req.headers['idempotency-key'] as string;
      const existing = rows.find((r) => r.ws === ws && r.key === key);
      if (existing && opts.idempotent) return send(200, { trainer: { id: existing.id, name, speciality } });
      const row = { id: String(rows.length + 1), ws, key, name, speciality };
      rows.push(row);
      send(201, { trainer: { id: row.id, name, speciality } });
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })));
}

describe('T4 release smoke check (AC-017, AC-012, AC-016, AC-018)', () => {
  const open: { close: () => unknown }[] = [];
  afterEach(async () => {
    await Promise.all(open.splice(0).map((s) => s.close()));
  });

  async function liveGateway(opts: { idempotent: boolean; gatewaySecret?: string }) {
    const trainers = await fakeTrainers(opts);
    open.push(trainers.server);
    const app: FastifyInstance = await buildGateway({ webUrl: trainers.url, routes: { '/api/trainers': trainers.url }, sessionSecret: opts.gatewaySecret ?? secret });
    await app.listen({ host: '127.0.0.1', port: 0 });
    open.push(app);
    return `http://127.0.0.1:${(app.server.address() as AddressInfo).port}/`;
  }

  it('passes every step against a working gateway and trainers service', async () => {
    const steps = await runSmoke(await liveGateway({ idempotent: true }), secret, { runId: 'abc123' });
    expect(steps.map((s) => s.step)).toEqual([
      'trainers service health',
      'add a trainer',
      'trainer is listed',
      'still listed after a refresh',
      'listed in a second signed-in session',
      'repeated add attempt creates one record',
      'signed-out request refused',
      'other workspace does not see it',
    ]);
    expect(steps.filter((s) => !s.ok)).toEqual([]);
    expect(formatSmoke(steps)).toMatch(/all 8 checks passed$/);
  });

  it('works under a sub-path base URL such as /FIT-941/', async () => {
    const base = await liveGateway({ idempotent: true });
    const calls: string[] = [];
    // The test environment serves the gateway under /FIT-941/; map that prefix back here.
    const viaPrefix: typeof fetch = (input, init) => {
      calls.push(String(input));
      return fetch(String(input).replace('/FIT-941/', '/'), init);
    };
    const steps = await runSmoke(`${base}FIT-941`, secret, { fetch: viaPrefix });
    expect(steps.every((s) => s.ok)).toBe(true);
    expect(calls.every((c) => c.startsWith(`${base}FIT-941/api/trainers/`))).toBe(true);
  });

  it('fails the duplicate step when a repeated add creates a second record', async () => {
    const steps = await runSmoke(await liveGateway({ idempotent: false }), secret);
    expect(steps.find((s) => s.step === 'repeated add attempt creates one record')?.ok).toBe(false);
    expect(formatSmoke(steps)).toMatch(/1 of 8 checks failed$/);
  });

  it('fails the data steps when the gateway has no matching secret (nobody can sign in)', async () => {
    const steps = await runSmoke(await liveGateway({ idempotent: true, gatewaySecret: '' }), secret);
    expect(steps.find((s) => s.step === 'trainers service health')?.ok).toBe(true);
    expect(steps.find((s) => s.step === 'add a trainer')).toMatchObject({ ok: false, detail: 'HTTP 401' });
    expect(steps.find((s) => s.step === 'signed-out request refused')?.ok).toBe(true);
  });

  it('reports an unreachable gateway as failures instead of throwing', async () => {
    const steps = await runSmoke('http://127.0.0.1:1/', secret);
    expect(steps.every((s) => !s.ok)).toBe(true);
    expect(steps[0]!.detail).toBe('HTTP 0');
  });
});

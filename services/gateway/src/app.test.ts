import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildGateway, parseRoutes, serviceHeaders } from './app.js';
import { signSession, tokenOf, verifySession } from './session.js';

/** A stand-in upstream that answers with its name, the path and the identity headers it received. */
function upstream(name: string): Promise<{ server: Server; url: string; hits: () => number }> {
  let hits = 0;
  const server = createServer((req, res) => {
    hits++;
    res.end(JSON.stringify({ name, path: req.url, ws: req.headers['x-gms-workspace'] ?? null, user: req.headers['x-gms-user'] ?? null, auth: req.headers.authorization ?? null, cookie: req.headers.cookie ?? null }));
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, hits: () => hits })));
}

const secret = 'test-only-secret-0123456789abcdef-0123456789';
const inAnHour = () => Math.floor(Date.now() / 1000) + 3600;
const bearer = (ws: string, sub = 'staff-1') => ({ authorization: `Bearer ${signSession({ sub, ws, exp: inAnHour() }, secret)}` });

describe('gateway', () => {
  const servers: Server[] = [];
  let routes: Record<string, string>;
  let webUrl: string;
  let classesHits: () => number;
  beforeAll(async () => {
    const [web, classes] = await Promise.all([upstream('web'), upstream('classes')]);
    servers.push(web.server, classes.server);
    webUrl = web.url;
    classesHits = classes.hits;
    routes = { '/api/classes': classes.url };
  });
  afterAll(() => servers.forEach((s) => s.close()));

  it('answers its health check', async () => {
    const app = await buildGateway({ webUrl, routes, sessionSecret: secret });
    const res = await app.inject('/health');
    expect(res.json()).toEqual({ status: 'ok', routes: ['/api/classes'] });
  });

  it('sends /api/<service> to that service without the prefix, and the rest to the web app', async () => {
    const app = await buildGateway({ webUrl, routes, sessionSecret: secret });
    expect((await app.inject({ url: '/api/classes/today', headers: bearer('gym-a') })).json()).toMatchObject({ name: 'classes', path: '/today' });
    expect((await app.inject('/dashboard')).json()).toMatchObject({ name: 'web', path: '/dashboard' });
  });

  it('reads routes from configuration and refuses bad ones', () => {
    expect(parseRoutes('/api/classes=http://classes:3000, /api/members=http://members:3000')).toEqual({ '/api/classes': 'http://classes:3000', '/api/members': 'http://members:3000' });
    expect(parseRoutes(undefined)).toEqual({});
    expect(() => parseRoutes('classes=http://x')).toThrow(/bad route/);
  });

  describe('sign-in check (FIT-941 NFR-001, AC-018)', () => {
    it('refuses signed-out, forged, expired and unconfigured requests before they reach a service', async () => {
      const app = await buildGateway({ webUrl, routes, sessionSecret: secret });
      const before = classesHits();
      const forged = signSession({ sub: 'staff-1', ws: 'gym-a', exp: inAnHour() }, 'another-secret-0123456789abcdef-0123');
      const expired = signSession({ sub: 'staff-1', ws: 'gym-a', exp: Math.floor(Date.now() / 1000) - 1 }, secret);
      for (const headers of [{}, { authorization: `Bearer ${forged}` }, { authorization: `Bearer ${expired}` }, { authorization: 'Bearer nonsense' }, { 'x-gms-workspace': 'gym-a' }]) {
        const res = await app.inject({ url: '/api/classes/today', headers });
        expect(res.statusCode).toBe(401);
        expect(res.json()).toEqual({ error: 'unauthenticated' });
      }
      const unconfigured = await buildGateway({ webUrl, routes });
      expect((await unconfigured.inject({ url: '/api/classes/today', headers: bearer('gym-a') })).statusCode).toBe(401);
      expect(classesHits()).toBe(before);
    });

    it('passes only the workspace from the session, ignoring one the browser names, and keeps tokens at the gateway', async () => {
      const app = await buildGateway({ webUrl, routes, sessionSecret: secret });
      const res = await app.inject({ url: '/api/classes/today', headers: { ...bearer('gym-a', 'staff-7'), 'x-gms-workspace': 'gym-b', 'x-gms-user': 'someone-else' } });
      expect(res.json()).toMatchObject({ ws: 'gym-a', user: 'staff-7', auth: null, cookie: null });
    });

    it('accepts the session from the gms_session cookie', async () => {
      const app = await buildGateway({ webUrl, routes, sessionSecret: secret });
      const token = signSession({ sub: 'staff-1', ws: 'gym-b', exp: inAnHour() }, secret);
      const res = await app.inject({ url: '/api/classes/today', headers: { cookie: `theme=dark; gms_session=${token}` } });
      expect(res.json()).toMatchObject({ ws: 'gym-b' });
    });

    it('keeps web app pages reachable without a session and never forwards browser-set identity headers', async () => {
      const app = await buildGateway({ webUrl, routes, sessionSecret: secret });
      const res = await app.inject({ url: '/', headers: { 'x-gms-workspace': 'gym-b' } });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ name: 'web', ws: null });
    });
  });
});

describe('sessions', () => {
  it('round-trips a signed session and rejects tampering, short secrets and bad ids', () => {
    const s = { sub: 'staff-1', ws: 'gym-a', exp: inAnHour() };
    const token = signSession(s, secret);
    expect(verifySession(token, secret)).toEqual(s);
    const [v, payload, sig] = token.split('.');
    const otherPayload = Buffer.from(JSON.stringify({ ...s, ws: 'gym-b' })).toString('base64url');
    expect(verifySession(`${v}.${otherPayload}.${sig}`, secret)).toBeNull();
    expect(verifySession(`${v}.${payload}`, secret)).toBeNull();
    expect(verifySession(signSession(s, 'short'), 'short')).toBeNull();
    expect(verifySession(signSession({ ...s, ws: 'gym a/../b' }, secret), secret)).toBeNull();
    expect(verifySession(undefined, secret)).toBeNull();
  });

  it('reads the token from Authorization or the cookie', () => {
    expect(tokenOf({ authorization: 'Bearer abc' })).toBe('abc');
    expect(tokenOf({ cookie: 'a=1; gms_session=xyz' })).toBe('xyz');
    expect(tokenOf({})).toBeUndefined();
  });

  it('strips identity headers when there is no session', () => {
    expect(serviceHeaders({ 'x-gms-workspace': 'gym-b', accept: 'x' }, null)).toEqual({ accept: 'x' });
  });
});

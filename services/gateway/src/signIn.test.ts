import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildGateway } from './app.js';
import { signSession, verifySession } from './session.js';
import { AFTER_SIGN_IN, SIGN_IN_COPY, issueSignInCode, sessionCookie } from './signIn.js';

const secret = 'test-only-secret-0123456789abcdef-0123456789';

describe('browser sign-in (FIT-941 AC-017, with AC-018 kept)', () => {
  let upstream: Server;
  let url: string;
  beforeAll(async () => {
    upstream = createServer((req, res) => res.end(JSON.stringify({ path: req.url, ws: req.headers['x-gms-workspace'] ?? null, body: null })));
    await new Promise<void>((r) => upstream.listen(0, r));
    url = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  });
  afterAll(() => upstream.close());
  const gateway = (sessionSecret: string | null = secret) => buildGateway({ webUrl: url, routes: { '/api/trainers': url }, sessionSecret: sessionSecret ?? undefined });
  const form = (code: string) => ({ method: 'POST' as const, url: '/sign-in', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams({ code }).toString() });

  it('shows a sign-in form that posts a code to a relative address', async () => {
    const res = await (await gateway()).inject('/sign-in');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain(SIGN_IN_COPY.title);
    expect(res.body).toContain('<form method="post" action="sign-in">');
    expect(res.body).toContain('<label for="code">Sign-in code</label>');
    expect(res.body).toContain('name="code"');
  });

  it('turns a valid code into the gms_session cookie and goes to Trainers', async () => {
    const code = issueSignInCode('rian', 'fitelite-test', secret);
    const res = await (await gateway()).inject(form(`  ${code}\n`));
    expect(res.statusCode).toBe(303);
    expect(res.headers.location).toBe(AFTER_SIGN_IN);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(new RegExp(`^gms_session=${code.replace(/\./g, '\\.')}; Max-Age=\\d+; HttpOnly; SameSite=Lax$`));
    expect(cookie).not.toMatch(/Path=/i);
  });

  it('the cookie it sets signs the browser in to its own workspace only', async () => {
    const app = await gateway();
    const code = issueSignInCode('rian', 'fitelite-test', secret);
    const cookie = String((await app.inject(form(code))).headers['set-cookie']).split(';')[0]!;
    const res = await app.inject({ url: '/api/trainers/trainers', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ path: '/trainers', ws: 'fitelite-test' });
  });

  it('refuses forged, expired, malformed and empty codes, and sets no cookie', async () => {
    const app = await gateway();
    const forged = signSession({ sub: 'rian', ws: 'fitelite-test', exp: Math.floor(Date.now() / 1000) + 600 }, 'another-secret-0123456789abcdef-0123');
    const expired = signSession({ sub: 'rian', ws: 'fitelite-test', exp: Math.floor(Date.now() / 1000) - 1 }, secret);
    for (const code of [forged, expired, 'nonsense', '']) {
      const res = await app.inject(form(code));
      expect(res.statusCode).toBe(401);
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(res.body).toContain(SIGN_IN_COPY.invalid);
    }
    const noBody = await app.inject({ method: 'POST', url: '/sign-in' });
    expect(noBody.statusCode).toBe(401);
    expect(noBody.headers['set-cookie']).toBeUndefined();
  });

  it('signs nobody in when the gateway has no SESSION_SECRET (fails closed)', async () => {
    const res = await (await gateway(null)).inject(form(issueSignInCode('rian', 'fitelite-test', secret)));
    expect(res.statusCode).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('signs out by clearing the cookie', async () => {
    const res = await (await gateway()).inject('/sign-out');
    expect(res.statusCode).toBe(200);
    expect(String(res.headers['set-cookie'])).toBe('gms_session=; Max-Age=0; HttpOnly; SameSite=Lax');
    expect(res.body).toContain(SIGN_IN_COPY.signedOut);
  });

  it('keeps form parsing away from requests proxied to services', async () => {
    const app = await gateway();
    const cookie = `gms_session=${issueSignInCode('rian', 'fitelite-test', secret)}`;
    const res = await app.inject({ method: 'POST', url: '/api/trainers/x', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, payload: 'a=1' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ path: '/x', ws: 'fitelite-test' });
  });

  it('issues codes that are ordinary signed sessions, and checks its inputs', () => {
    const now = Date.UTC(2026, 10, 20, 9);
    const code = issueSignInCode('staff-2', 'gym_a', secret, 2, now);
    expect(verifySession(code, secret, now)).toEqual({ sub: 'staff-2', ws: 'gym_a', exp: now / 1000 + 7200 });
    expect(verifySession(code, secret, now + 7200 * 1000)).toBeNull();
    expect(() => issueSignInCode('bad id', 'gym', secret)).toThrow();
    expect(() => issueSignInCode('rian', 'gym/../x', secret)).toThrow();
    expect(() => issueSignInCode('rian', 'gym', secret, 0)).toThrow();
    expect(() => issueSignInCode('rian', 'gym', secret, 24 * 8)).toThrow();
    expect(sessionCookie(code, { sub: 'staff-2', ws: 'gym_a', exp: now / 1000 + 60 }, now)).toContain('Max-Age=60;');
  });
});

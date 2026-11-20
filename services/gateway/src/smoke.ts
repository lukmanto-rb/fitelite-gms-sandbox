// FIT-941 T4: release smoke check for the Trainers page, run against a live gateway.
//
//   docker compose exec gateway node dist/smoke.js [base URL, default http://127.0.0.1:8080/]
//
// It runs inside the gateway container, which already has SESSION_SECRET, so no secret is copied
// anywhere. It signs short-lived test sessions (as a signed-in staff member would carry) for a
// dedicated smoke-check workspace, so it never touches a real gym's trainers, and checks:
//   1. the trainers service health check answers through the gateway;
//   2. a trainer added through the gateway is listed;
//   3. it is still listed on a fresh load (refresh) and in a second signed-in session (AC-017);
//   4. repeating the same add attempt creates no second record (AC-012, AC-016);
//   5. signed-out and other-workspace requests see none of it (AC-018).
// The 320 px check is visual: open the page in a browser narrowed to 320 px (see docs/FIT-941-release.md).

import { randomUUID } from 'node:crypto';
import { signSession } from './session.js';

export interface SmokeStep {
  step: string;
  ok: boolean;
  detail: string;
}

type Fetch = typeof fetch;

/** Runs every step and reports each one; it never throws for a failing check. */
export async function runSmoke(baseUrl: string, secret: string, opts: { fetch?: Fetch; runId?: string } = {}): Promise<SmokeStep[]> {
  const f = opts.fetch ?? fetch;
  const runId = opts.runId ?? randomUUID().replace(/-/g, '').slice(0, 12);
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = (path: string) => new URL(path, base).toString();
  const exp = Math.floor(Date.now() / 1000) + 600;
  const ws = 'smoke-check';
  const auth = (sub: string, workspace = ws) => ({ authorization: `Bearer ${signSession({ sub, ws: workspace, exp }, secret)}` });
  const trainer = { name: `Smoke check ${runId}`, speciality: 'Release check' };
  const key = `smoke-${runId}`;
  const steps: SmokeStep[] = [];
  const record = (step: string, ok: boolean, detail: string) => steps.push({ step, ok, detail });

  const call = async (path: string, init: RequestInit = {}) => {
    try {
      const res = await f(url(path), init);
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, body };
    } catch (err) {
      return { status: 0, body: null, error: err instanceof Error ? err.message : 'request failed' };
    }
  };
  const countIn = (body: unknown) => {
    const list = (body as { trainers?: { name?: string; speciality?: string }[] } | null)?.trainers;
    return Array.isArray(list) ? list.filter((t) => t.name === trainer.name && t.speciality === trainer.speciality).length : -1;
  };
  const add = () =>
    call('api/trainers/trainers', {
      method: 'POST',
      headers: { ...auth('smoke-staff-1'), 'content-type': 'application/json', 'idempotency-key': key },
      body: JSON.stringify(trainer),
    });

  const health = await call('api/trainers/health');
  record('trainers service health', health.status === 200, `HTTP ${health.status}`);

  const first = await add();
  const firstId = (first.body as { trainer?: { id?: string } } | null)?.trainer?.id;
  record('add a trainer', first.status === 201 && !!firstId, `HTTP ${first.status}`);

  const listed = await call('api/trainers/trainers', { headers: auth('smoke-staff-1') });
  record('trainer is listed', listed.status === 200 && countIn(listed.body) === 1, `HTTP ${listed.status}, listed ${countIn(listed.body)} time(s)`);

  const refreshed = await call('api/trainers/trainers', { headers: auth('smoke-staff-1') });
  record('still listed after a refresh', refreshed.status === 200 && countIn(refreshed.body) === 1, `HTTP ${refreshed.status}, listed ${countIn(refreshed.body)} time(s)`);

  const second = await call('api/trainers/trainers', { headers: auth('smoke-staff-2') });
  record('listed in a second signed-in session', second.status === 200 && countIn(second.body) === 1, `HTTP ${second.status}, listed ${countIn(second.body)} time(s)`);

  const again = await add();
  const againId = (again.body as { trainer?: { id?: string } } | null)?.trainer?.id;
  const afterRepeat = await call('api/trainers/trainers', { headers: auth('smoke-staff-1') });
  record(
    'repeated add attempt creates one record',
    again.status === 200 && !!firstId && againId === firstId && countIn(afterRepeat.body) === 1,
    `HTTP ${again.status}, same record ${!!firstId && againId === firstId}, listed ${countIn(afterRepeat.body)} time(s)`,
  );

  const signedOut = await call('api/trainers/trainers');
  record('signed-out request refused', signedOut.status === 401, `HTTP ${signedOut.status}`);

  const other = await call('api/trainers/trainers', { headers: auth('smoke-staff-3', `${ws}-other`) });
  record('other workspace does not see it', other.status === 200 && countIn(other.body) === 0, `HTTP ${other.status}, listed ${countIn(other.body)} time(s)`);

  return steps;
}

/** One line per step; no trainer values beyond the smoke-check record, no secrets. */
export function formatSmoke(steps: SmokeStep[]): string {
  const lines = steps.map((s) => `${s.ok ? 'PASS' : 'FAIL'}  ${s.step} (${s.detail})`);
  const failed = steps.filter((s) => !s.ok).length;
  lines.push(failed ? `${failed} of ${steps.length} checks failed` : `all ${steps.length} checks passed`);
  return lines.join('\n');
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const secret = process.env.SESSION_SECRET ?? process.env.GMS_SESSION_SECRET ?? '';
  if (secret.length < 32) {
    console.error('SESSION_SECRET (32+ characters) is not set: the gateway refuses every API request. Set GMS_SESSION_SECRET in .env and restart.');
    process.exit(2);
  }
  const steps = await runSmoke(process.argv[2] ?? 'http://127.0.0.1:8080/', secret);
  console.log(formatSmoke(steps));
  process.exit(steps.every((s) => s.ok) ? 0 : 1);
}

// The trainers service API (FIT-941). Reached through the gateway at /api/trainers/... (the prefix
// is removed). The gateway checks sign-in and passes the caller's gym or workspace in the
// x-gms-workspace header; it removes any value a browser sent, and compose.yaml publishes no
// service ports, so this header can only come from the gateway.
//
// Interim behaviour while OQ-001 to OQ-004 are open (see docs/trainers.md); each is one constant
// or one function below so a decision is a small change:
// - OQ-001: speciality is required free text; no catalogue (SPECIALITY_RULE).
// - OQ-002: anyone the gateway signs in for the workspace may view and add.
// - OQ-003: stable creation order, no promised sort (LIST_ORDER).
// - OQ-004: no rule on matching name and speciality; only one add attempt = one record.

import Fastify, { type FastifyError, type FastifyInstance, type FastifyRequest } from 'fastify';
import type { Db } from './db.js';

export const WORKSPACE_HEADER = 'x-gms-workspace';
export const IDEMPOTENCY_HEADER = 'idempotency-key';
export const NAME_MAX = 100;
/** OQ-003 is undecided: creation order is stable and promises no sort. */
const LIST_ORDER = 'id ASC';

export interface Trainer {
  id: string;
  name: string;
  speciality: string;
}

type FieldError = 'required' | 'too_long';

/** Characters as people count them (code points), so "García" is 6, not more. */
const length = (s: string) => Array.from(s).length;

/** FR-004, FR-005, BR-003: trims surrounding whitespace only; keeps case, punctuation, accents. */
export function validateTrainer(body: unknown): { ok: true; name: string; speciality: string } | { ok: false; fields: Record<string, FieldError> } {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const speciality = typeof input.speciality === 'string' ? input.speciality.trim() : '';
  const fields: Record<string, FieldError> = {};
  if (!name) fields.name = 'required';
  else if (length(name) > NAME_MAX) fields.name = 'too_long';
  // OQ-001 undecided: speciality is only required (free text, no length rule, no list).
  if (!speciality) fields.speciality = 'required';
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, name, speciality };
}

const WORKSPACE = /^[A-Za-z0-9_-]{1,64}$/;
const ATTEMPT_KEY = /^[A-Za-z0-9_-]{8,128}$/;

function workspaceOf(req: FastifyRequest): string | null {
  const value = req.headers[WORKSPACE_HEADER];
  return typeof value === 'string' && WORKSPACE.test(value) ? value : null;
}

const row = (r: { id: string | number; name: string; speciality: string }): Trainer => ({ id: String(r.id), name: r.name, speciality: r.speciality });

export async function buildApp(deps: { db: Db }): Promise<FastifyInstance> {
  // A trainer is two short strings; a small body limit keeps oversized input out.
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024 });

  // Error responses carry codes only: no trainer data and no free-text details (NFR-002).
  app.setErrorHandler((err: FastifyError, _req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    return reply.code(status).send({ error: status === 500 ? 'service_error' : 'bad_request' });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'not_found' }));

  app.get('/health', async () => {
    await deps.db.query('SELECT 1');
    return { status: 'ok', service: 'trainers' };
  });

  // Every trainer read and save needs a workspace from the gateway (NFR-001, BR-006).
  app.addHook('onRequest', async (req, reply) => {
    if (req.url === '/health') return;
    if (!workspaceOf(req)) return reply.code(401).send({ error: 'unauthenticated' });
  });

  // FR-002: every saved trainer in the caller's workspace, and only those.
  app.get('/trainers', async (req) => {
    const { rows } = await deps.db.query<Trainer>(
      `SELECT id, name, speciality FROM trainers WHERE workspace_id = $1 ORDER BY ${LIST_ORDER}`,
      [workspaceOf(req)],
    );
    return { trainers: rows.map(row) };
  });

  // FR-006, FR-008: one add attempt (one Idempotency-Key) creates at most one trainer. A repeat of
  // the same attempt returns the original record (200) instead of creating another (201).
  app.post('/trainers', async (req, reply) => {
    const workspace = workspaceOf(req)!;
    const key = req.headers[IDEMPOTENCY_HEADER];
    if (typeof key !== 'string' || !ATTEMPT_KEY.test(key)) return reply.code(400).send({ error: 'idempotency_key_required' });
    const valid = validateTrainer(req.body);
    if (!valid.ok) return reply.code(400).send({ error: 'validation', fields: valid.fields });

    const inserted = await deps.db.query<Trainer>(
      `INSERT INTO trainers (workspace_id, name, speciality, idempotency_key) VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, idempotency_key) DO NOTHING RETURNING id, name, speciality`,
      [workspace, valid.name, valid.speciality, key],
    );
    if (inserted.rows[0]) return reply.code(201).send({ trainer: row(inserted.rows[0]) });

    const existing = (await deps.db.query<Trainer>(
      'SELECT id, name, speciality FROM trainers WHERE workspace_id = $1 AND idempotency_key = $2',
      [workspace, key],
    )).rows[0];
    // The same key with different values is not an unchanged retry: refuse rather than guess.
    if (!existing || existing.name !== valid.name || existing.speciality !== valid.speciality) {
      return reply.code(409).send({ error: 'idempotency_key_reused' });
    }
    return reply.code(200).send({ trainer: row(existing) });
  });

  return app;
}

// GMS sign-in check at the gateway (FIT-941, NFR-001). A signed-in staff member carries a session
// token, in the gms_session cookie or an "Authorization: Bearer" header:
//   v1.<base64url JSON {sub, ws, exp}>.<base64url HMAC-SHA256 of the first two parts>
// signed with SESSION_SECRET (from the environment, never the repo). The gateway trusts only the
// workspace inside a valid token; it never trusts a workspace a browser names itself.

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface Session {
  /** Staff member id. */
  sub: string;
  /** Gym or workspace id: the data boundary for every service call. */
  ws: string;
  /** Expiry, seconds since 1970. */
  exp: number;
}

export const SESSION_COOKIE = 'gms_session';
/** Shorter secrets are refused, so a weak configuration fails closed. */
export const MIN_SECRET_LENGTH = 32;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const sign = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest('base64url');

export function signSession(session: Session, secret: string): string {
  const data = `v1.${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  return `${data}.${sign(data, secret)}`;
}

/** The session in a token, or null when it is missing, forged, malformed or expired. */
export function verifySession(token: string | undefined, secret: string | undefined, now = Date.now()): Session | null {
  if (!token || !secret || secret.length < MIN_SECRET_LENGTH) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`, secret));
  const given = Buffer.from(parts[2]!);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as Partial<Session>;
    if (typeof s.sub !== 'string' || !ID.test(s.sub) || typeof s.ws !== 'string' || !ID.test(s.ws)) return null;
    if (typeof s.exp !== 'number' || s.exp * 1000 <= now) return null;
    return { sub: s.sub, ws: s.ws, exp: s.exp };
  } catch {
    return null;
  }
}

/** The session token a request carries: Authorization: Bearer first, then the gms_session cookie. */
export function tokenOf(headers: { authorization?: string; cookie?: string }): string | undefined {
  const auth = headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  for (const part of (headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === SESSION_COOKIE) return v.join('=');
  }
  return undefined;
}

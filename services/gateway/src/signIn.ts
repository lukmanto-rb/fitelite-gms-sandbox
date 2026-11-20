// Browser sign-in for the test release (FIT-941, AC-017). It uses the existing GMS sign-in: the
// signed session in session.ts. Nothing new is trusted:
//   - A staff member gets a sign-in code with `node dist/sign-in-code.js <staff id> <workspace>`
//     inside the gateway container. The code is a normal signed GMS session (v1.<data>.<HMAC>),
//     made with the gateway's own SESSION_SECRET, so no secret leaves the container.
//   - GET  sign-in  shows a small form for the code.
//   - POST sign-in  checks the code with verifySession. A valid code is stored in the browser as
//                   the gms_session cookie (HttpOnly, SameSite=Lax), then the browser goes to Trainers.
//                   An invalid, forged or expired code sets nothing.
//   - GET  sign-out removes the cookie.
// The workspace comes only from the signed code; the form cannot name one. Paths and redirects
// are relative and the cookie has no Path attribute, so the browser scopes it to the folder the
// app runs in: /FIT-941/ in the test environment, / when the product runs alone.

import type { FastifyInstance, FastifyReply } from 'fastify';
import { SESSION_COOKIE, signSession, verifySession, type Session } from './session.js';

export const SIGN_IN_PATH = '/sign-in';
export const SIGN_OUT_PATH = '/sign-out';
/** Where a signed-in browser goes next, relative to the sign-in page. */
export const AFTER_SIGN_IN = './#/trainers';
/** How long a new sign-in code (and so the browser session) lasts unless asked otherwise. */
export const DEFAULT_CODE_HOURS = 12;
const MAX_CODE_HOURS = 24 * 7;

export const SIGN_IN_COPY = {
  title: 'Sign in to GMS',
  intro: 'Paste the sign-in code you were given.',
  label: 'Sign-in code',
  submit: 'Sign in',
  invalid: 'That sign-in code is not valid or has expired.',
  signedOut: 'You are signed out.',
} as const;

const page = (message?: { text: string; error: boolean }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${SIGN_IN_COPY.title}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px 16px; color: #1a1a1a; }
  main { max-width: 420px; margin: 0 auto; }
  h1 { font-size: 24px; }
  label { display: block; font-weight: 600; margin: 16px 0 4px; }
  textarea { width: 100%; box-sizing: border-box; font: 14px monospace; min-height: 96px; }
  button { margin-top: 16px; font-size: 16px; padding: 8px 16px; }
  :focus-visible { outline: 3px solid #1a56db; outline-offset: 2px; }
  .error { color: #b00020; }
</style>
</head>
<body>
<main>
<h1>${SIGN_IN_COPY.title}</h1>
<p>${SIGN_IN_COPY.intro}</p>
${message ? `<p role="${message.error ? 'alert' : 'status'}"${message.error ? ' class="error"' : ''}>${message.text}</p>` : ''}
<form method="post" action="sign-in">
<label for="code">${SIGN_IN_COPY.label}</label>
<textarea id="code" name="code" required autocomplete="off" spellcheck="false"></textarea>
<button type="submit">${SIGN_IN_COPY.submit}</button>
</form>
</main>
</body>
</html>`;

const html = (reply: FastifyReply, status: number, body: string) =>
  reply.code(status).header('content-type', 'text/html; charset=utf-8').header('cache-control', 'no-store').send(body);

/** The Set-Cookie value for a verified session. No Path: the browser uses the sign-in page's folder. */
export function sessionCookie(token: string, session: Session, now = Date.now()): string {
  const maxAge = Math.max(0, session.exp - Math.floor(now / 1000));
  return `${SESSION_COOKIE}=${token}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
}

export const CLEAR_COOKIE = `${SESSION_COOKIE}=; Max-Age=0; HttpOnly; SameSite=Lax`;

/** A sign-in code for one staff member in one workspace: a signed GMS session. */
export function issueSignInCode(staff: string, workspace: string, secret: string, hours = DEFAULT_CODE_HOURS, now = Date.now()): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(staff) || !/^[A-Za-z0-9_-]{1,64}$/.test(workspace)) {
    throw new Error('staff id and workspace: 1 to 64 letters, digits, "-" or "_"');
  }
  if (!(hours > 0 && hours <= MAX_CODE_HOURS)) throw new Error(`hours: more than 0 and at most ${MAX_CODE_HOURS}`);
  return signSession({ sub: staff, ws: workspace, exp: Math.floor(now / 1000) + Math.round(hours * 3600) }, secret);
}

export async function registerSignIn(app: FastifyInstance, sessionSecret: string | undefined): Promise<void> {
  // Its own scope, so the form parser below never touches requests proxied to services.
  await app.register(async (scope) => {
    scope.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string', bodyLimit: 8 * 1024 }, (_req, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body as string)));
    });

    scope.get(SIGN_IN_PATH, async (_req, reply) => html(reply, 200, page()));

    scope.post(SIGN_IN_PATH, async (req, reply) => {
      const code = typeof (req.body as { code?: unknown } | null)?.code === 'string' ? (req.body as { code: string }).code.trim() : '';
      const session = verifySession(code, sessionSecret);
      if (!session) return html(reply, 401, page({ text: SIGN_IN_COPY.invalid, error: true }));
      return reply.code(303).header('set-cookie', sessionCookie(code, session)).header('cache-control', 'no-store').header('location', AFTER_SIGN_IN).send();
    });

    scope.get(SIGN_OUT_PATH, async (_req, reply) =>
      html(reply.header('set-cookie', CLEAR_COOKIE), 200, page({ text: SIGN_IN_COPY.signedOut, error: false })),
    );
  });
}

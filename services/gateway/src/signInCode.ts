// Prints a GMS sign-in code for the test release (FIT-941). Run inside the gateway container,
// which already has SESSION_SECRET, so the secret is never copied anywhere:
//
//   docker compose exec gateway node dist/signInCode.js <staff id> <workspace> [hours, default 12]
//
// Give each person (or each browser) its own staff id; people in the same workspace see the same
// trainers. Paste the printed code into http://localhost:8080/FIT-941/sign-in.

import { DEFAULT_CODE_HOURS, issueSignInCode } from './signIn.js';
import { MIN_SECRET_LENGTH } from './session.js';

const [staff, workspace, hours] = process.argv.slice(2);
const secret = process.env.SESSION_SECRET ?? '';
if (secret.length < MIN_SECRET_LENGTH) {
  console.error('SESSION_SECRET (32+ characters) is not set. Set GMS_SESSION_SECRET in .env and restart.');
  process.exit(2);
}
if (!staff || !workspace) {
  console.error('Usage: node dist/signInCode.js <staff id> <workspace> [hours]');
  process.exit(2);
}
try {
  console.log(issueSignInCode(staff, workspace, secret, hours ? Number(hours) : DEFAULT_CODE_HOURS));
} catch (err) {
  console.error((err as Error).message);
  process.exit(2);
}

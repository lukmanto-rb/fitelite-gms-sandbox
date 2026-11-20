// FIT-941 AC-017 end to end, through the browser sign-in of the test release:
// the real web app (App, Trainers page), the real gateway (sign-in, session check, routing) and the
// real trainers service on its own database (PGlite). Each Browser is a separate cookie jar, so a
// second Browser is a second computer: it shares nothing with the first except the server.
// A refresh throws away the whole page (React state included) and loads it again.
// AC-018 is re-checked on the same path: signed-out and other-workspace browsers.

import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import App from '../../../apps/web/src/App';
import { buildGateway } from '../../../services/gateway/src/app';
import { issueSignInCode } from '../../../services/gateway/src/signIn';
import { buildApp } from '../../../services/trainers/src/app';
import { memoryDb, migrate, type Db } from '../../../services/trainers/src/db';
import { Browser, PAGE_URL } from './browser';

const secret = 'e2e-only-secret-0123456789abcdef-0123456789';
const WORKSPACE = 'fitelite-test';
const SOFIA = { name: 'Sofia García', speciality: 'Pilates' };

let db: Db;
let trainers: FastifyInstance;
let gateway: FastifyInstance;
let gatewayUrl: string;

const listen = async (app: FastifyInstance) => {
  await app.listen({ host: '127.0.0.1', port: 0 });
  return `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
};

beforeAll(async () => {
  db = await memoryDb();
  // Node file URL (jsdom replaces the global URL class); vitest runs from tests/e2e.
  await migrate(db, pathToFileURL(resolve(process.cwd(), '../../services/trainers/src/migrations') + '/'));
  trainers = await buildApp({ db });
  const trainersUrl = await listen(trainers);
  // The web app's files are not needed: the page is rendered here; the gateway serves the API and sign-in.
  gateway = await buildGateway({ webUrl: trainersUrl, routes: { '/api/trainers': trainersUrl }, sessionSecret: secret });
  gatewayUrl = await listen(gateway);
});

afterAll(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await gateway?.close();
  await trainers?.close();
  await db?.close();
});

/** Signs a browser in the way a staff member does: open sign-in, paste the code, submit the form. */
async function signIn(browser: Browser, staff: string, workspace = WORKSPACE) {
  const page = await browser.fetch('sign-in');
  expect(page.status).toBe(200);
  const doc = new DOMParser().parseFromString(await page.text(), 'text/html');
  const form = doc.querySelector('form')!;
  const field = form.querySelector('textarea')!;
  expect(doc.querySelector(`label[for="${field.id}"]`)?.textContent).toBe('Sign-in code');
  const action = new URL(form.getAttribute('action')!, new URL('sign-in', PAGE_URL));
  const res = await browser.fetch(action.toString(), {
    method: form.getAttribute('method')!.toUpperCase(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ [field.name]: issueSignInCode(staff, workspace, secret) }).toString(),
  });
  expect(res.status).toBe(303);
  const next = new URL(res.headers.get('location')!, action);
  expect(next.toString()).toBe(`${PAGE_URL}#/trainers`);
  expect(browser.cookieNames()).toEqual(['gms_session']);
}

/** Opens (or reloads) the GMS page in this browser on the Trainers route. */
function open(browser: Browser) {
  cleanup();
  vi.stubGlobal('fetch', browser.fetch);
  window.location.hash = '#/trainers';
  render(<App />);
}

const table = () => screen.getByRole('table', { name: 'All trainers' });
const rowsMatching = (t: { name: string; speciality: string }) =>
  within(table())
    .queryAllByRole('row')
    .filter((r) => within(r).queryByText(t.name, { exact: true }) && within(r).queryByText(t.speciality, { exact: true }));

async function addTrainer(t: { name: string; speciality: string }) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: t.name } });
  fireEvent.change(screen.getByLabelText('Speciality'), { target: { value: t.speciality } });
  fireEvent.click(screen.getByRole('button', { name: 'Add trainer' }));
  await screen.findByText('Trainer added.');
}

describe('FIT-941 AC-017 in the browser, signed in through the test release', () => {
  it('a confirmed trainer is still listed once after a refresh and on a second signed-in computer', async () => {
    const first = new Browser(gatewayUrl);
    await signIn(first, 'rian');

    open(first);
    expect(screen.getByRole('link', { name: 'Trainers' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('No trainers yet')).toBeInTheDocument();
    await addTrainer(SOFIA);
    expect(rowsMatching(SOFIA)).toHaveLength(1);

    // Refresh: the page and all its state are gone; the list comes from the server again.
    open(first);
    expect(screen.getByText('Loading trainers…')).toBeInTheDocument();
    await waitFor(() => expect(rowsMatching(SOFIA)).toHaveLength(1));
    expect(screen.queryByText('No trainers yet')).not.toBeInTheDocument();

    // Another computer: a separate browser with its own sign-in, same GMS workspace, nothing re-entered.
    const second = new Browser(gatewayUrl);
    await signIn(second, 'rian-laptop-2');
    open(second);
    await waitFor(() => expect(rowsMatching(SOFIA)).toHaveLength(1));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Speciality') as HTMLInputElement).value).toBe('');

    // Exactly one saved record on the server, with the same values.
    const saved = await db.query<{ name: string; speciality: string; workspace_id: string }>('SELECT name, speciality, workspace_id FROM trainers');
    expect(saved.rows).toEqual([{ ...SOFIA, workspace_id: WORKSPACE }]);
  });

  it('AC-018 still holds on this path: signed-out and other-workspace browsers cannot read or add', async () => {
    // Signed out: nothing is shown and nothing can be added.
    const signedOut = new Browser(gatewayUrl);
    open(signedOut);
    expect(await screen.findByText("Couldn't load trainers. Try again.")).toBeInTheDocument();
    expect(rowsMatching(SOFIA)).toHaveLength(0);
    const post = await signedOut.fetch('api/trainers/trainers', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'e2e-signed-out-1' },
      body: JSON.stringify({ name: 'Mallory', speciality: 'X' }),
    });
    expect(post.status).toBe(401);

    // A sign-in code for another workspace: that workspace's list only.
    const other = new Browser(gatewayUrl);
    await signIn(other, 'outsider', 'another-gym');
    open(other);
    expect(await screen.findByText('No trainers yet')).toBeInTheDocument();
    expect(rowsMatching(SOFIA)).toHaveLength(0);

    // Signing out removes the session from the browser; the list is refused again.
    const leaving = new Browser(gatewayUrl);
    await signIn(leaving, 'rian');
    expect((await leaving.fetch('sign-out')).status).toBe(200);
    expect(leaving.cookieNames()).toEqual([]);
    open(leaving);
    expect(await screen.findByText("Couldn't load trainers. Try again.")).toBeInTheDocument();

    const names = (await db.query<{ name: string }>('SELECT name FROM trainers')).rows.map((r) => r.name);
    expect(names).toEqual([SOFIA.name]);
  });
});

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildGateway, parseRoutes } from './app.js';

/** A stand-in upstream that answers with its name and the path it received. */
function upstream(name: string): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => res.end(JSON.stringify({ name, path: req.url })));
  return new Promise((resolve) => server.listen(0, () => resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })));
}

describe('gateway', () => {
  const servers: Server[] = [];
  let routes: Record<string, string>;
  let webUrl: string;
  beforeAll(async () => {
    const [web, classes] = await Promise.all([upstream('web'), upstream('classes')]);
    servers.push(web.server, classes.server);
    webUrl = web.url;
    routes = { '/api/classes': classes.url };
  });
  afterAll(() => servers.forEach((s) => s.close()));

  it('answers its health check', async () => {
    const app = await buildGateway({ webUrl, routes });
    const res = await app.inject('/health');
    expect(res.json()).toEqual({ status: 'ok', routes: ['/api/classes'] });
  });

  it('sends /api/<service> to that service without the prefix, and the rest to the web app', async () => {
    const app = await buildGateway({ webUrl, routes });
    expect((await app.inject('/api/classes/today')).json()).toEqual({ name: 'classes', path: '/today' });
    expect((await app.inject('/dashboard')).json()).toEqual({ name: 'web', path: '/dashboard' });
  });

  it('reads routes from configuration and refuses bad ones', () => {
    expect(parseRoutes('/api/classes=http://classes:3000, /api/members=http://members:3000')).toEqual({ '/api/classes': 'http://classes:3000', '/api/members': 'http://members:3000' });
    expect(parseRoutes(undefined)).toEqual({});
    expect(() => parseRoutes('classes=http://x')).toThrow(/bad route/);
  });
});

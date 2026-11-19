// The API gateway: the product's single entry point. Requests to /api/<service>/... go to that
// service; everything else goes to the web app. Routes come from configuration, never from code.

import Fastify, { type FastifyInstance } from 'fastify';
import proxy from '@fastify/http-proxy';

export interface GatewayConfig {
  /** The web app's internal address, e.g. http://web:80. */
  webUrl: string;
  /** Path prefix → service address, e.g. { '/api/classes': 'http://classes:3000' }. */
  routes: Record<string, string>;
}

/** Parses ROUTES="/api/classes=http://classes:3000,/api/members=http://members:3000". */
export function parseRoutes(value: string | undefined): Record<string, string> {
  const routes: Record<string, string> = {};
  for (const pair of (value ?? '').split(',').map((p) => p.trim()).filter(Boolean)) {
    const [prefix, url] = pair.split('=');
    if (!prefix?.startsWith('/api/') || !url?.startsWith('http')) throw new Error(`bad route "${pair}": use /api/<service>=http://<service>:<port>`);
    routes[prefix] = url;
  }
  return routes;
}

export async function buildGateway(config: GatewayConfig): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.get('/health', async () => ({ status: 'ok', routes: Object.keys(config.routes) }));
  // Longest prefixes first, so /api/classes/admin wins over /api/classes.
  for (const [prefix, upstream] of Object.entries(config.routes).sort((a, b) => b[0].length - a[0].length)) {
    await app.register(proxy, { upstream, prefix, rewritePrefix: '' });
  }
  await app.register(proxy, { upstream: config.webUrl, prefix: '/' });
  return app;
}

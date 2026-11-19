// The API gateway: the product's single entry point. Requests to /api/<service>/... go to that
// service; everything else goes to the web app. Routes come from configuration, never from code.
// It is also where sign-in is checked (FIT-941, NFR-001): every /api request needs a valid GMS
// session, and services receive the caller's workspace only from that session.

import Fastify, { type FastifyInstance } from 'fastify';
import proxy from '@fastify/http-proxy';
import type { IncomingHttpHeaders } from 'node:http';
import { tokenOf, verifySession, type Session } from './session.js';

/** Headers the gateway sets for services from a verified session; a browser can never set them. */
export const WORKSPACE_HEADER = 'x-gms-workspace';
export const USER_HEADER = 'x-gms-user';

export interface GatewayConfig {
  /** The web app's internal address, e.g. http://web:80. */
  webUrl: string;
  /** Path prefix → service address, e.g. { '/api/classes': 'http://classes:3000' }. */
  routes: Record<string, string>;
  /** Signs GMS sessions (SESSION_SECRET). Missing or short: every /api request is refused. */
  sessionSecret?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    gmsSession: Session | null;
  }
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

/** Forwarded headers: identity comes only from the verified session; tokens stay at the gateway. */
export function serviceHeaders(headers: IncomingHttpHeaders, session: Session | null): IncomingHttpHeaders {
  const out: IncomingHttpHeaders = { ...headers };
  for (const name of Object.keys(out)) if (name.startsWith('x-gms-')) delete out[name];
  if (session) {
    delete out.authorization;
    delete out.cookie;
    out[WORKSPACE_HEADER] = session.ws;
    out[USER_HEADER] = session.sub;
  }
  return out;
}

export async function buildGateway(config: GatewayConfig): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorateRequest('gmsSession', null);
  // Every /api/... request needs a valid session, or it is refused here and never reaches a
  // service. Web app pages stay reachable, so navigation keeps working.
  // The one exception is each service's own health check (GET/HEAD <prefix>/health, exact path):
  // it carries no business data and must stay reachable for liveness checks. It still reaches the
  // service with no identity headers.
  const healthPaths = new Set(Object.keys(config.routes).map((prefix) => `${prefix}/health`));
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return;
    const path = req.url.split('?')[0]!;
    if ((req.method === 'GET' || req.method === 'HEAD') && healthPaths.has(path)) return;
    req.gmsSession = verifySession(tokenOf(req.headers), config.sessionSecret);
    if (!req.gmsSession) return reply.code(401).send({ error: 'unauthenticated' });
  });
  const replyOptions = {
    rewriteRequestHeaders: (req: { gmsSession?: Session | null }, headers: IncomingHttpHeaders) => serviceHeaders(headers, req.gmsSession ?? null),
  };

  app.get('/health', async () => ({ status: 'ok', routes: Object.keys(config.routes) }));
  // Longest prefixes first, so /api/classes/admin wins over /api/classes.
  for (const [prefix, upstream] of Object.entries(config.routes).sort((a, b) => b[0].length - a[0].length)) {
    await app.register(proxy, { upstream, prefix, rewritePrefix: '', replyOptions } as never);
  }
  await app.register(proxy, { upstream: config.webUrl, prefix: '/', replyOptions } as never);
  return app;
}

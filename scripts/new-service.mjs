// Creates a new microservice from the standard skeleton (see docs/ARCHITECTURE.md):
//   npm run new-service <name>
// services/<name>/ with its own API (Fastify), its own PostgreSQL database and migrations, tests
// (an in-memory PostgreSQL, PGlite), a Dockerfile; plus its container, its database container
// and its gateway route (/api/<name>) in compose.yaml.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]{1,30}$/.test(name) || ['gateway', 'web'].includes(name)) {
  console.error('usage: npm run new-service <name>   (lowercase letters, digits and dashes; not gateway or web)');
  process.exit(1);
}
const dir = `services/${name}`;
if (existsSync(dir)) {
  console.error(`${dir} already exists`);
  process.exit(1);
}
const db = `${name}-db`;
const pkgName = `@fitelite-gms/${name}`;
const files = {
  'package.json': JSON.stringify({
    name: pkgName,
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: {
      build: "tsc -p tsconfig.build.json && node -e \"require('fs').cpSync('src/migrations','dist/migrations',{recursive:true})\"",
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
      start: 'node dist/server.js',
    },
  }, null, 2) + '\n',
  'tsconfig.json': readFileSync('services/gateway/tsconfig.json', 'utf8'),
  'tsconfig.build.json': readFileSync('services/gateway/tsconfig.build.json', 'utf8'),
  'src/db.ts': `// This service's own database. Production: PostgreSQL (DATABASE_URL). Tests: PGlite, an
// in-memory PostgreSQL, so tests need no database server. Only this service reads or writes it.

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

export async function postgresDb(url: string): Promise<Db> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url });
  return { query: async (sql, params) => ({ rows: (await pool.query(sql, params)).rows }), close: () => pool.end() };
}

export async function memoryDb(): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  return { query: async (sql, params) => ({ rows: (await db.query(sql, params)).rows as never[] }), close: () => db.close() };
}

/** Applies the SQL files in migrations/ in name order, each once. */
export async function migrate(db: Db, dir = new URL('./migrations/', import.meta.url)): Promise<string[]> {
  const { readdirSync, readFileSync } = await import('node:fs');
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const done = new Set((await db.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    await db.query(readFileSync(new URL(file, dir), 'utf8'));
    await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    applied.push(file);
  }
  return applied;
}
`,
  'src/migrations/001_init.sql': `-- ${name}: first migration. Add tables in new numbered files (002_..., 003_...); never edit an applied one.\nSELECT 1;\n`,
  'src/app.ts': `// The ${name} service API. Reached through the gateway at /api/${name}/... (the prefix is removed).

import Fastify, { type FastifyInstance } from 'fastify';
import type { Db } from './db.js';

export async function buildApp(deps: { db: Db }): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.get('/health', async () => {
    await deps.db.query('SELECT 1');
    return { status: 'ok', service: '${name}' };
  });
  return app;
}
`,
  'src/server.ts': `import { buildApp } from './app.js';
import { migrate, postgresDb } from './db.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const db = await postgresDb(url);
await migrate(db);
const app = await buildApp({ db });
const port = Number(process.env.PORT ?? 3000);
await app.listen({ host: '0.0.0.0', port });
console.log('${name} on :' + port);
`,
  'src/app.test.ts': `import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { memoryDb, migrate } from './db.js';

describe('${name} service', () => {
  it('migrates its database and answers its health check', async () => {
    const db = await memoryDb();
    expect(await migrate(db)).toContain('001_init.sql');
    expect(await migrate(db)).toEqual([]);
    const app = await buildApp({ db });
    expect((await app.inject('/health')).json()).toEqual({ status: 'ok', service: '${name}' });
    await db.close();
  });
});
`,
  Dockerfile: `# ${name} service. Build context: the repo root (npm workspaces).
FROM node:24-slim AS build
WORKDIR /repo
COPY . .
RUN npm ci --no-audit --no-fund && npm run build -w ${dir} && npm prune --omit=dev && mkdir -p ${dir}/node_modules

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/node_modules ./node_modules
# Packages npm kept inside the workspace (not hoisted to the root).
COPY --from=build /repo/${dir}/node_modules ./node_modules
COPY --from=build /repo/${dir}/package.json ./
COPY --from=build /repo/${dir}/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --retries=12 CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
`,
};
for (const [file, body] of Object.entries(files)) {
  mkdirSync(`${dir}/${file.split('/').slice(0, -1).join('/')}`, { recursive: true });
  writeFileSync(`${dir}/${file}`, body);
}

// compose.yaml: the service, its database and its route.
let compose = readFileSync('compose.yaml', 'utf8');
const block = `  ${name}:
    build: { context: ., dockerfile: ${dir}/Dockerfile }
    environment:
      PORT: "3000"
      DATABASE_URL: postgres://${name}:${name}@${db}:5432/${name}
    depends_on:
      ${db}: { condition: service_healthy }
    restart: unless-stopped

  ${db}:
    image: postgres:18
    environment:
      POSTGRES_USER: ${name}
      POSTGRES_PASSWORD: ${name}
      POSTGRES_DB: ${name}
    volumes: [${db}:/var/lib/postgresql]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${name} -d ${name}"]
      interval: 3s
      timeout: 3s
      retries: 20
    restart: unless-stopped

`;
compose = compose.replace('  # >>> services:', `${block}  # >>> services:`);
compose = compose.replace(/  # >>> volumes:(.*)\n  \{\}\n/, '  # >>> volumes:$1\n');
compose = compose.replace(/(  # >>> volumes:.*\n)/, `  ${db}: {}\n$1`);
compose = compose.replace(/ROUTES: "([^"]*)"/, (_m, routes) => `ROUTES: "${[routes, `/api/${name}=http://${name}:3000`].filter(Boolean).join(',')}"`);
compose = compose.replace(/(  gateway:[\s\S]*?depends_on:\n)/, `$1      ${name}: { condition: service_healthy }\n`);
writeFileSync('compose.yaml', compose);
// Its packages (same versions as the rest of the repo where they exist).
const npm = (args) => {
  const r = spawnSync('npm', args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
npm(['install', '--no-audit', '--no-fund']); // registers the new workspace first
npm(['install', '--no-audit', '--no-fund', '-w', dir, 'fastify', 'pg']);
npm(['install', '--no-audit', '--no-fund', '-w', dir, '-D', '@electric-sql/pglite', '@types/pg', '@types/node', 'typescript', 'vitest']);
console.log(`created ${dir} (API, database, migrations, tests, Dockerfile); added ${name} and ${db} to compose.yaml and /api/${name} to the gateway.`);

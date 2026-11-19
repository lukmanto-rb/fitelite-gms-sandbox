// This service's own database. Production: PostgreSQL (DATABASE_URL). Tests: PGlite, an
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

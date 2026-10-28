import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import './load-env.mjs';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required to run migrations.');
const here = dirname(fileURLToPath(import.meta.url));
const migrationDirectory = join(here, '../../../supabase/migrations');
const pool = new Pool({ connectionString: databaseUrl });
try {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith('.sql')).sort();
  for (const name of files) {
    const existing = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
    if (existing.rowCount) continue;
    const sql = await readFile(join(migrationDirectory, name), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let authCount;
      if (name === '003_server_reset.sql') {
        const target = new URL(databaseUrl);
        if (target.hostname !== '127.0.0.1' || target.port !== '54322' || target.pathname !== '/postgres') {
          throw new Error('Server reset is restricted to local Supabase at 127.0.0.1:54322/postgres');
        }
        await client.query('LOCK TABLE auth.users IN SHARE MODE');
        authCount = (await client.query('SELECT count(*)::int AS count FROM auth.users')).rows[0].count;
        const backup = { authCount, tables: {} };
        for (const table of ['users', 'auth_sessions', 'auth_identities', 'characters', 'player_stats', 'auth_revoked_tokens']) {
          const exists = await client.query('SELECT to_regclass($1) AS name', [`public.${table}`]);
          if (!exists.rows[0].name) continue;
          await client.query(`LOCK TABLE public.${table} IN ACCESS EXCLUSIVE MODE`);
          backup.tables[table] = (await client.query(`SELECT * FROM public.${table}`)).rows;
        }
        const recovery = join(here, '../../../.refactor-backups/supabase-only-2026-10-08');
        await mkdir(recovery, { recursive: true });
        const backupPath = join(recovery, `application-data-${Date.now()}.json`);
        await writeFile(backupPath, JSON.stringify(backup, null, 2), { flag: 'wx', mode: 0o600 });
        process.stdout.write(`Saved application-data recovery backup: ${backupPath}\n`);
      }
      await client.query(sql);
      if (authCount !== undefined) {
        const remaining = (await client.query('SELECT count(*)::int AS count FROM auth.users')).rows[0].count;
        if (remaining !== authCount) throw new Error('Auth account count changed; rolling back');
        process.stdout.write(`Preserved ${remaining} Supabase Auth accounts.\n`);
      }
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      process.stdout.write(`Applied ${name}\n`);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  process.stdout.write('Database migrations are current.\n');
} finally { await pool.end(); }

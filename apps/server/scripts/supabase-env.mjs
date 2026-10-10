import { writeFile } from 'node:fs/promises';
import { supabase } from './supabase.mjs';

const result = supabase(['status', '-o', 'json'], { encoding: 'utf8' });
if (result.error || result.status !== 0) throw new Error('Local Supabase must be running before generating its environment');
const status = JSON.parse(result.stdout);
const url = status.API_URL;
const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const database = status.DB_URL;
if (!url || !key || !database) throw new Error('Local Supabase status did not include API URL, publishable key and database URL');
if (new URL(url).hostname !== '127.0.0.1' || new URL(database).hostname !== '127.0.0.1') throw new Error('Only local Supabase environment generation is supported');
const testDatabase = new URL(database);
testDatabase.pathname = '/lifeabroad_test';
const contents = [
  '# Generated local-only configuration. Keep this file out of version control.',
  `SUPABASE_URL=${url}`, `SUPABASE_PUBLISHABLE_KEY=${key}`,
  `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY ?? ''}`,
  `DATABASE_URL=${database}`, `TEST_DATABASE_URL=${testDatabase.href}`, 'TEST_SUPABASE_ENABLED=true', `TEST_SUPABASE_URL=${url}`,
  `TEST_SUPABASE_PUBLISHABLE_KEY=${key}`, `TEST_SUPABASE_DATABASE_URL=${database}`, '',
].join('\n');
await writeFile(new URL('../.env.supabase.local', import.meta.url), contents, { encoding: 'utf8', mode: 0o600 });
process.stdout.write('Wrote apps/server/.env.supabase.local (no keys printed). Restart NestJS to activate local Supabase.\n');

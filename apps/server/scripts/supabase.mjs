import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function supabase(args, options = {}) {
  return spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url)), ...args],
    { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' }, ...options });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = supabase(process.argv.slice(2), { encoding: 'utf8' });
  if (result.error) throw result.error;
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  // CLI status/start includes local secret keys. Keep them out of logs.
  const safe = output.split('\n').filter((line) => !/SECRET|ANON_KEY|SERVICE_ROLE|PUBLISHABLE_KEY|sb_secret_|sb_publishable_|eyJ[A-Za-z0-9_-]+\./.test(line)).join('\n');
  process.stdout.write(safe);
  if (result.status === 0) process.stdout.write('Local Supabase command completed. Use supabase:env for configuration without printing keys.\n');
  process.exitCode = result.status ?? 1;
}

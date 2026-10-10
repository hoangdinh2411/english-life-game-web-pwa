import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

for (const path of [resolve(process.cwd(), '.env.supabase.local'), resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  let contents;
  try { contents = await readFile(path, 'utf8'); }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') continue;
    throw error;
  }
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const raw = match[2] ?? '';
    process.env[match[1]] = raw.length >= 2 && ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) ? raw.slice(1, -1) : raw.replace(/\s+#.*$/, '');
  }
}

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const tests = readdirSync('dist/tests').filter((name) => name.endsWith('.test.js') && !name.endsWith('.integration.test.js')).sort();
const result = spawnSync(process.execPath, ['--test', ...tests.map((name) => `dist/tests/${name}`)], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

import './load-env.mjs';
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--test', 'dist/tests/database.integration.test.js', 'dist/tests/players.integration.test.js'], { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

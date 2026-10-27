import './load-env.mjs';
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--test', 'dist/tests/country-worlds.integration.test.js', 'dist/tests/first-run.integration.test.js', 'dist/tests/database.integration.test.js', 'dist/tests/players.integration.test.js', 'dist/tests/quests.integration.test.js', 'dist/tests/conversations.integration.test.js', 'dist/tests/content.integration.test.js', 'dist/tests/legacy-clock-cleanup.integration.test.js', 'dist/tests/life.integration.test.js', 'dist/tests/quick-rest.integration.test.js', 'dist/tests/seller.integration.test.js', 'dist/tests/learning.integration.test.js', 'dist/tests/id-card.integration.test.js'], { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

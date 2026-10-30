import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';

const [path, expected] = process.argv.slice(2);
if (!path || !/^[a-f0-9]{64}$/.test(expected ?? '')) throw new Error('Usage: verify-file-sha256 <file> <lowercase-sha256>');
const actual = createHash('sha256').update(await readFile(path)).digest('hex');
if (!timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw new Error(`SHA-256 verification failed for ${path}.`);
console.log(JSON.stringify({ path, sha256: actual, valid: true }));


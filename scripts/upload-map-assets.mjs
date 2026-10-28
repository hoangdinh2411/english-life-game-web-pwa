import { generateAndUpload } from './generate-map-assets.mjs';

const args = process.argv.slice(2).filter(argument => argument !== '--');
const targetArgs = args.filter((argument) => argument === '--target' || argument.startsWith('--target='));
if (targetArgs.length > 1) throw new Error('Specify --target only once.');

let target = 'local';
let positionalArgs = args;
if (targetArgs.length) {
  const targetIndex = args.indexOf(targetArgs[0]);
  const targetArgument = targetArgs[0];
  target = targetArgument.startsWith('--target=') ? targetArgument.slice('--target='.length) : args[targetIndex + 1] ?? '';
  positionalArgs = args.filter((_, index) => index !== targetIndex && (targetArgument.startsWith('--target=') || index !== targetIndex + 1));
}
if (target !== 'local' && target !== 'staging' && target !== 'production') throw new Error('Usage: assets:upload [--target local|staging|production] [mapId] [version]');

if (target === 'local') await import('../apps/server/scripts/load-env.mjs');

const [mapId = 'loc_town_street', version = '1'] = positionalArgs;
if (!/^[1-9]\d*$/.test(version)) throw new Error('Version must be a positive integer');
const baseUrl = target === 'local'
  ? process.env.CONTENT_API_URL ?? 'http://127.0.0.1:3000/api/v1'
  : target === 'staging' ? process.env.CONTENT_API_URL : process.env.PRODUCTION_CONTENT_API_URL;
const serviceKey = target === 'local'
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : target === 'staging' ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !serviceKey) {
  throw new Error(target === 'local'
    ? 'Local CONTENT_API_URL and SUPABASE_SERVICE_ROLE_KEY are required. Start local Supabase and run supabase:env.'
    : `${target === 'staging' ? 'STAGING' : 'PRODUCTION'}_CONTENT_API_URL and ${target === 'staging' ? 'STAGING' : 'PRODUCTION'}_SUPABASE_SERVICE_ROLE_KEY must be supplied through the deployment environment.`);
}

const parsedUrl = new URL(baseUrl);
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
if ((target === 'local' && !localHosts.has(parsedUrl.hostname)) ||
    (target !== 'local' && (parsedUrl.protocol !== 'https:' || localHosts.has(parsedUrl.hostname)))) {
  throw new Error(`The ${target} target has an invalid API URL.`);
}

const assets = await generateAndUpload({ mapId, version: Number(version),
  baseUrl: baseUrl.replace(/\/+$/, ''), serviceKey });
console.log(JSON.stringify({ target, mapId, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0), assets, localAssetDirectory: `local-assets/maps/${mapId}`, localFilesRetained: true }, null, 2));

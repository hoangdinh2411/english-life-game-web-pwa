import { syncMapAssets } from './sync-map-assets.mjs';

const rawArgs = process.argv.slice(2).filter(argument => argument !== '--');
const dryRun = rawArgs.includes('--dry-run');
const args = rawArgs.filter(argument => argument !== '--dry-run');
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
if (target !== 'local' && target !== 'staging' && target !== 'production') throw new Error('Usage: assets:upload [--dry-run] [--target local|staging|production] [mapId]');

if (target === 'local') await import('../apps/server/scripts/load-env.mjs');

const [mapId = 'loc_town_street', extra] = positionalArgs;
if (extra) throw new Error('Versions are assigned automatically from SHA-256 metadata.');
const baseUrl = target === 'local'
  ? process.env.CONTENT_API_URL ?? 'http://127.0.0.1:3000/api/v1'
  : target === 'staging' ? process.env.STAGING_CONTENT_API_URL : process.env.PRODUCTION_CONTENT_API_URL;
const serviceKey = target === 'local'
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : target === 'staging' ? process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY : process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY;
const urlVariable = target === 'local' ? 'CONTENT_API_URL'
  : target === 'staging' ? 'STAGING_CONTENT_API_URL' : 'PRODUCTION_CONTENT_API_URL';
const keyVariable = target === 'local' ? 'SUPABASE_SERVICE_ROLE_KEY'
  : target === 'staging' ? 'STAGING_SUPABASE_SERVICE_ROLE_KEY' : 'PRODUCTION_SUPABASE_SERVICE_ROLE_KEY';
const missingVariables = [
  ...(!baseUrl ? [urlVariable] : []),
  ...(!dryRun && !serviceKey ? [keyVariable] : []),
];
if (missingVariables.length > 0) {
  throw new Error(target === 'local'
    ? `Local ${missingVariables.join(' and ')} required. Start local Supabase and run supabase:env.`
    : `${missingVariables.join(' and ')} must be supplied through the deployment environment.`);
}

const parsedUrl = new URL(baseUrl);
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
if ((target === 'local' && !localHosts.has(parsedUrl.hostname)) ||
    (target !== 'local' && (parsedUrl.protocol !== 'https:' || localHosts.has(parsedUrl.hostname)))) {
  throw new Error(`The ${target} target has an invalid API URL.`);
}

const result = await syncMapAssets({ mapId, dryRun, baseUrl: baseUrl.replace(/\/+$/, ''), serviceKey });
console.log(JSON.stringify({ target, ...result, localAssetDirectory: `local-assets/maps/${mapId}`, localFilesRetained: true }, null, 2));

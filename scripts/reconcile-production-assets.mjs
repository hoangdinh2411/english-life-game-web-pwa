import { syncMapAssets, supportedMaps } from './sync-map-assets.mjs';
import { requireHttpsProductionUrl } from './deployment-safety.mjs';

const args = new Set(process.argv.slice(2).filter(argument => argument !== '--'));
const apply = args.has('--apply');
const check = args.has('--check');
if (apply === check || args.size !== 1) throw new Error('Choose exactly one of --check or --apply.');
const baseUrl = requireHttpsProductionUrl('PRODUCTION_CONTENT_API_URL', process.env.PRODUCTION_CONTENT_API_URL).href.replace(/\/$/, '');
const serviceKey = apply ? process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY : undefined;
if (apply && !serviceKey) throw new Error('PRODUCTION_SUPABASE_SERVICE_ROLE_KEY is required for --apply.');

const results = [];
for (const mapId of supportedMaps) results.push(await syncMapAssets({ mapId, baseUrl, serviceKey, dryRun: !apply }));
const changed = results.reduce((total, result) => total + result.uploadCount, 0);
console.log(JSON.stringify({ mode: apply ? 'apply' : 'check', changed, remoteDeletes: 0, maps: results }, null, 2));
if (check && changed > 0) process.exitCode = 1;


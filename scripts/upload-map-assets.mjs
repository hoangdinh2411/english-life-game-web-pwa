import { generateAndUpload } from './generate-map-assets.mjs';
import '../apps/server/scripts/load-env.mjs';

const [mapId = 'loc_town_street', version = '1'] = process.argv.slice(2);
if (!/^[1-9]\d*$/.test(version)) throw new Error('Version must be a positive integer');
const assets = await generateAndUpload({ mapId, version: Number(version),
  baseUrl: process.env.CONTENT_API_URL ?? 'http://127.0.0.1:3000/api/v1', serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY });
console.log(JSON.stringify({ mapId, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0), assets, localFilesDeleted: true }, null, 2));

import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { assetIdSchema, type AssetUpload, type MapPack } from '@life-abroad/shared';
import { DatabaseService } from '../../infrastructure/database/database.service';

export interface AssetFile { originalname: string; mimetype: string; buffer: Buffer; size: number }
interface AssetRow { key: string; type: MapPack['assets'][number]['type']; version: number; path: string; bytes: number; npc_id: string | null; sha256: string }
const extensions: Record<string, string> = {
  'image/png': 'png', 'image/svg+xml': 'svg', 'image/webp': 'webp',
  'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'application/json': 'json',
};

@Injectable()
export class ContentService {
  constructor(private readonly database: DatabaseService, private readonly config: ConfigService) {}
  private storage() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new ServiceUnavailableException('Asset storage is not configured.');
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from('game-assets');
  }
  async upload(input: AssetUpload, file: AssetFile | undefined): Promise<{ path: string; url: string; bytes: number }> {
    if (!file || !file.size || file.size > 20971520) throw new BadRequestException('One nonempty file up to 20 MiB is required.');
    const extension = extensions[file.mimetype];
    const key = file.originalname.replace(/\.[^.]+$/, '');
    if (!extension || !assetIdSchema.safeParse(key).success || file.originalname !== `${key}.${extension}`) throw new BadRequestException('Unsupported asset filename or media type.');
    const expected = input.type === 'audio' ? 'audio/' : ['json', 'animation'].includes(input.type) ? 'application/json' : 'image/';
    if (!file.mimetype.startsWith(expected)) throw new BadRequestException('Asset type does not match the file.');
    if (file.mimetype === 'application/json') {
      try { JSON.parse(file.buffer.toString('utf8')); } catch { throw new BadRequestException('Invalid JSON.'); }
    }
    const npc = input.npcId ? (await this.database.query<{ location_id: string }>('SELECT location_id FROM npcs WHERE id=$1', [input.npcId])).rows[0] : undefined;
    const mapId = input.mapId ?? npc?.location_id;
    if (!mapId) throw new BadRequestException('An asset map is required.');
    if (input.npcId && (!npc || npc.location_id !== mapId)) throw new BadRequestException('NPC does not belong to this map.');
    if (!(await this.database.query('SELECT 1 FROM locations WHERE id=$1', [mapId])).rowCount) throw new NotFoundException('Map not found.');
    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const path = `${mapId}/${input.npcId ?? 'map'}/${key}/v${input.version}-${hash}.${extension}`;
    const storage = this.storage();
    // Version slots are immutable. A retry of identical bytes returns the existing path.
    return this.database.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${mapId}/${input.npcId ?? ''}/${key}`]);
      const existing = await client.query<{ path: string; type: string }>('SELECT path,type FROM assets WHERE map_id=$1 AND npc_id IS NOT DISTINCT FROM $2 AND key=$3 AND version=$4', [mapId, input.npcId ?? null, key, input.version]);
      if (existing.rows[0]) {
        if (existing.rows[0].path !== path || existing.rows[0].type !== input.type) throw new ConflictException('Use a new version for changed content.');
        return { path, url: storage.getPublicUrl(path).data.publicUrl, bytes: file.size };
      }
      const result = await storage.upload(path, file.buffer, { contentType: file.mimetype, cacheControl: '31536000', upsert: false });
      if (result.error) throw new ServiceUnavailableException('Asset upload failed.');
      try {
        await client.query('INSERT INTO assets(map_id,npc_id,key,type,version,path,bytes,sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [mapId, input.npcId ?? null, key, input.type, input.version, path, file.size, hash]);
      } catch (error: unknown) { await storage.remove([path]); throw error; }
      return { path, url: storage.getPublicUrl(path).data.publicUrl, bytes: file.size };
    });
  }
  async map(mapId: string): Promise<MapPack> {
    const result = await this.database.query<AssetRow>(`SELECT DISTINCT ON (a.key, a.npc_id) a.key,a.type,a.version,a.path,a.bytes,a.npc_id,a.sha256
      FROM assets a LEFT JOIN npcs n ON n.id=a.npc_id
      WHERE a.map_id=$1 OR (a.map_id IS NULL AND n.location_id=$1)
      ORDER BY a.key,a.npc_id,a.version DESC`, [mapId]);
    if (!result.rows.some((asset) => asset.type === 'map')) throw new NotFoundException('Map pack is not available.');
    const storage = this.storage();
    return { mapId, assets: result.rows.map((asset) => ({ key: asset.key, type: asset.type, version: asset.version,
      url: storage.getPublicUrl(asset.path).data.publicUrl, bytes: asset.bytes, npcId: asset.npc_id, sha256: asset.sha256 })) };
  }
}

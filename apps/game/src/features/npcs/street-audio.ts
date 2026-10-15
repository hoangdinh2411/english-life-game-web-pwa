import { recordedVoiceManifestSchema, type MapPack } from '@life-abroad/shared';
import type { StationAudioCatalog } from '../../types/speech/narration';
import { fetchMapPack } from '../assets/map-pack';

export function streetAudioCatalog(pack: MapPack, input: unknown): StationAudioCatalog {
  const manifest = recordedVoiceManifestSchema.parse(input);
  if (pack.mapId !== 'loc_town_street') throw new Error('Street voice map is invalid.');
  return manifest.clips.map(clip => {
    const asset = pack.assets.find(asset => asset.key === clip.key && asset.type === 'audio' && asset.npcId === null);
    if (!asset) throw new Error('A street recording is missing. Please refresh after the voice upload finishes.');
    return { text: clip.text, gender: clip.gender, asset: asset.url };
  });
}

let loaded: Promise<StationAudioCatalog> | undefined;
export function loadStreetAudio(): Promise<StationAudioCatalog> {
  loaded ??= (async () => {
    const pack = await fetchMapPack('loc_town_street', AbortSignal.timeout(15000));
    const manifest = pack.assets.find(asset => asset.key === 'street-voices' && asset.type === 'json' && asset.npcId === null);
    if (!manifest) throw new Error('Street recordings have not been uploaded yet.');
    const response = await fetch(manifest.url, { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Street recordings could not load. Please retry the conversation.');
    return streetAudioCatalog(pack, await response.json());
  })().catch((error: unknown) => { loaded = undefined; throw error; });
  return loaded;
}

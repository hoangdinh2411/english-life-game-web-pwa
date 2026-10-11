import type Phaser from 'phaser';
import type { Appearance } from '@life-abroad/shared';
import { recolorPlayerPixels } from './player-colors';

export function paintPlayerTexture(scene: Phaser.Scene, sourceKey: string, targetKey: string, appearance: Appearance | undefined, destination: boolean): string {
  const source = scene.textures.get(sourceKey);
  const image = source.getSourceImage();
  const texture = scene.textures.exists(targetKey)
    ? scene.textures.get(targetKey) as Phaser.Textures.CanvasTexture
    : scene.textures.createCanvas(targetKey, source.source[0]!.width, source.source[0]!.height);
  if (!texture) throw new Error('Character appearance texture could not be created.');
  texture.context.clearRect(0, 0, texture.width, texture.height);
  texture.context.drawImage(image as CanvasImageSource, 0, 0);
  if (appearance) {
    const data = texture.context.getImageData(0, 0, texture.width, texture.height);
    data.data.set(recolorPlayerPixels(data.data, texture.width, appearance, destination));
    texture.context.putImageData(data, 0, 0);
  }
  for (const name of source.getFrameNames()) {
    const frame = source.get(name);
    if (!texture.has(name)) texture.add(name, 0, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight);
  }
  texture.refresh();
  return targetKey;
}

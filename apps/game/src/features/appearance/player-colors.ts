import type { Appearance } from '@life-abroad/shared';

type Color = readonly [number, number, number];
const hair: Record<Appearance['hair'], Color> = { brown: [105, 72, 54], black: [38, 35, 36], blond: [210, 170, 76], blue: [57, 101, 180] };
const shirts: Record<NonNullable<Appearance['shirt']>, Color> = { blue: [57, 113, 188], green: [58, 137, 85], red: [187, 60, 58], yellow: [213, 177, 53] };
const trousers: Record<Appearance['trousers'], Color> = { navy: [48, 67, 103], charcoal: [60, 60, 60], brown: [116, 79, 52] };

// Frame-local zones exclude the face, hands, backpack, and shoes. Hue checks
// restrict station recoloring to the existing material rather than all pixels.
export function recolorPlayerPixels(pixels: Uint8ClampedArray, width: number, appearance: Appearance, destination: boolean): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels);
  for (let index = 0; index < result.length; index += 4) {
    const x = (index / 4 % width) % 32;
    const sheetY = Math.floor(index / 4 / width);
    const y = sheetY % 48;
    const row = Math.floor(sheetY / 48);
    const r = pixels[index] ?? 0, g = pixels[index + 1] ?? 0, b = pixels[index + 2] ?? 0, alpha = pixels[index + 3] ?? 0;
    let color: Color | undefined;
    if (destination) {
      if (alpha > 0 && Math.abs(r - 66) <= 2 && Math.abs(g - 111) <= 2 && Math.abs(b - 97) <= 2 && appearance.shirt) color = shirts[appearance.shirt];
      else if (alpha > 0 && Math.abs(r - 51) <= 2 && Math.abs(g - 72) <= 2 && Math.abs(b - 94) <= 2) color = trousers[appearance.trousers];
      // The procedural destination sheet has no hair. Add a small cap only
      // into transparent pixels; face pixels remain byte-for-byte unchanged.
      else if (alpha === 0 && y >= 1 && y <= 5 && x >= 10 && x <= 22) {
        result.set([...hair[appearance.hair], 255], index);
        continue;
      }
    } else if (alpha > 0) {
      const darkBrown = r < 150 && r >= g && r >= b && r > 20;
      if (y >= 2 && y <= (row === 3 ? 20 : 13) && x >= 5 && x <= 27 && darkBrown) color = hair[appearance.hair];
      else if (y >= 17 && y <= 35 && b > r * 1.2 && g > r * 1.15 && appearance.shirt) color = shirts[appearance.shirt];
      else if (y >= 34 && y <= 41 && x >= 9 && x <= 23 && darkBrown) color = trousers[appearance.trousers];
    }
    if (!color) continue;
    const shade = destination ? 1 : Math.max(0.25, Math.min(1.45, (r + g + b) / 3 / 85));
    result[index] = color[0] * shade;
    result[index + 1] = color[1] * shade;
    result[index + 2] = color[2] * shade;
  }
  return result;
}

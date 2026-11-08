import type { Appearance } from '@life-abroad/shared';

export function appearanceSignature(appearance: Appearance | undefined): string {
  return appearance ? `${appearance.hair}|${appearance.shirt ?? ''}|${appearance.trousers}` : '';
}

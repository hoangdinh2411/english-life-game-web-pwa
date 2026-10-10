import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseOnboardingOptions, type OnboardingOptions } from '@life-abroad/shared';

export const ONBOARDING_SEED_DIRECTORY = 'ONBOARDING_SEED_DIRECTORY';

@Injectable()
export class OnboardingService {
  private catalog: Promise<OnboardingOptions> | undefined;

  constructor(@Inject(ONBOARDING_SEED_DIRECTORY) private readonly directory: string) {}

  async getOptions(): Promise<OnboardingOptions> {
    // Cache successful reads; failed loads can be retried after content is repaired.
    this.catalog ??= this.loadCatalog().catch(() => {
      this.catalog = undefined;
      throw new ServiceUnavailableException('Onboarding options are unavailable');
    });
    return parseOnboardingOptions(await this.catalog);
  }

  private async loadCatalog(): Promise<OnboardingOptions> {
    const [townJson, avatarsJson] = await Promise.all([
      readFile(join(this.directory, 'town.json'), 'utf8'),
      readFile(join(this.directory, 'avatars.json'), 'utf8'),
    ]);
    const town: unknown = JSON.parse(townJson);
    const avatars: unknown = JSON.parse(avatarsJson);
    if (typeof town !== 'object' || town === null || !('isStarterCity' in town) || town.isStarterCity !== true) {
      throw new Error('town.json must explicitly mark the starter city');
    }
    const city = town as Record<string, unknown>;
    const options = parseOnboardingOptions({ cities: [{ id: city.id, name: city.name, description: city.description }], avatars });
    if (options.cities.length === 0 || options.avatars.length === 0) throw new Error('Empty onboarding catalog');
    return options;
  }
}

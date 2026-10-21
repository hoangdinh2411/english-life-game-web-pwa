import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseCountryCatalog, parseOnboardingOptions, type CountryCatalogEntry, type OnboardingOptions } from '@life-abroad/shared';

export const ONBOARDING_SEED_DIRECTORY = 'ONBOARDING_SEED_DIRECTORY';

@Injectable()
export class OnboardingService {
  private catalog: Promise<OnboardingOptions> | undefined;
  private countries: CountryCatalogEntry[] = [];

  constructor(@Inject(ONBOARDING_SEED_DIRECTORY) private readonly directory: string) {}

  async getOptions(): Promise<OnboardingOptions> {
    // Cache successful reads; failed loads can be retried after content is repaired.
    this.catalog ??= this.loadCatalog().catch(() => {
      this.catalog = undefined;
      throw new ServiceUnavailableException('Onboarding options are unavailable');
    });
    return parseOnboardingOptions(await this.catalog);
  }

  async getCountry(countryId: string): Promise<CountryCatalogEntry | undefined> {
    await this.getOptions();
    return this.countries.find(country => country.id === countryId);
  }

  private async loadCatalog(): Promise<OnboardingOptions> {
    const [countriesJson, townJson, avatarsJson] = await Promise.all([
      readFile(join(this.directory, 'countries.json'), 'utf8'),
      readFile(join(this.directory, 'town.json'), 'utf8'),
      readFile(join(this.directory, 'avatars.json'), 'utf8'),
    ]);
    const town: unknown = JSON.parse(townJson);
    const avatars: unknown = JSON.parse(avatarsJson);
    if (typeof town !== 'object' || town === null || !('isStarterCity' in town) || town.isStarterCity !== true) {
      throw new Error('town.json must explicitly mark the starter city');
    }
    const city = town as Record<string, unknown>;
    const countries = parseCountryCatalog(JSON.parse(countriesJson));
    if (!countries.every(country => country.starterCityId === city.id)) throw new Error('Country references an unknown starter city');
    this.countries = countries;
    const options = parseOnboardingOptions({ countries: countries.map(country => ({
      id: country.id, name: country.name, isoCode: country.isoCode, flag: country.flag, timeZone: country.timeZone,
    })), avatars });
    if (options.countries.length === 0 || options.avatars.length === 0) throw new Error('Empty onboarding catalog');
    return options;
  }
}

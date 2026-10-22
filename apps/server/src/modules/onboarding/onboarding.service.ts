import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseOnboardingOptions, type CountryCatalogEntry, type OnboardingOptions } from '@life-abroad/shared';
import { DatabaseService } from '../../infrastructure/database/database.service';

export const ONBOARDING_SEED_DIRECTORY = 'ONBOARDING_SEED_DIRECTORY';

interface CountryRow {
  id: string;
  name: string;
  iso_code: string;
  time_zone: string;
  starter_city_id: string;
}

function isoFlag(isoCode: string): string {
  return [...isoCode].map(letter => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('');
}

@Injectable()
export class OnboardingService {
  private catalog: Promise<OnboardingOptions> | undefined;
  private countries: CountryCatalogEntry[] = [];

  constructor(
    @Inject(ONBOARDING_SEED_DIRECTORY) private readonly directory: string,
    private readonly database: DatabaseService,
  ) {}

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
    const [countryResult, avatarsJson] = await Promise.all([
      this.database.query<CountryRow>(`SELECT id, name, iso_code, time_zone, starter_city_id
        FROM public.countries ORDER BY name, id`),
      readFile(join(this.directory, 'avatars.json'), 'utf8'),
    ]);
    const avatars: unknown = JSON.parse(avatarsJson);
    const countries: CountryCatalogEntry[] = countryResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      isoCode: row.iso_code,
      flag: isoFlag(row.iso_code),
      timeZone: row.time_zone,
      starterCityId: row.starter_city_id,
    }));
    this.countries = countries;
    const options = parseOnboardingOptions({ countries: countries.map(country => ({
      id: country.id, name: country.name, isoCode: country.isoCode, flag: country.flag, timeZone: country.timeZone,
    })), avatars });
    if (options.countries.length === 0 || options.avatars.length === 0) throw new Error('Empty onboarding catalog');
    return options;
  }
}

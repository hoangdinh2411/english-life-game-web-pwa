import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { parseOnboardingOptions, type CountryOption, type OnboardingOptions } from '@life-abroad/shared';
import { DatabaseService } from '../../infrastructure/database/database.service';

interface CountryRow {
  id: string;
  name: string;
  iso_code: string;
  time_zone: string;
}

function isoFlag(isoCode: string): string {
  return [...isoCode].map(letter => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('');
}

@Injectable()
export class OnboardingService {
  private catalog: Promise<OnboardingOptions> | undefined;

  constructor(private readonly database: DatabaseService) {}

  async getOptions(): Promise<OnboardingOptions> {
    // Cache successful reads; failed loads can be retried after content is repaired.
    this.catalog ??= this.loadCatalog().catch(() => {
      this.catalog = undefined;
      throw new ServiceUnavailableException('Onboarding options are unavailable');
    });
    return parseOnboardingOptions(await this.catalog);
  }

  private async loadCatalog(): Promise<OnboardingOptions> {
    const countryResult = await this.database.query<CountryRow>(`SELECT id, name, iso_code, time_zone
      FROM public.countries ORDER BY name, id`);
    const countries: CountryOption[] = countryResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      isoCode: row.iso_code,
      flag: isoFlag(row.iso_code),
      timeZone: row.time_zone,
    }));
    return parseOnboardingOptions({ countries });
  }
}

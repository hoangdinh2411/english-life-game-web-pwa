export type CountryOption = Readonly<{ id: string; name: string }>;

const normalizeText = (value: string): string =>
  value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches a country name mentioned in the player's text, preferring longer multi-word names first. */
export function matchCountry(input: string, countries: readonly CountryOption[]): CountryOption | undefined {
  const normalizedInput = normalizeText(input);
  if (!normalizedInput) return undefined;
  const sorted = [...countries].sort((a, b) => b.name.length - a.name.length);
  for (const country of sorted) {
    const normalizedName = normalizeText(country.name);
    if (!normalizedName) continue;
    if (normalizedInput === normalizedName) return country;
    const boundary = new RegExp(`(?:^|\\s)${escapeRegExp(normalizedName)}(?:\\s|$)`);
    if (boundary.test(normalizedInput)) return country;
  }
  return undefined;
}

const isAlreadyLockedError = (error: unknown): boolean =>
  (typeof error === 'object' && error !== null && 'status' in error && error.status === 409) ||
  (error instanceof Error && /already locked/i.test(error.message));

/**
 * Intercepts country mentions before forwarding the player's message to the conversation endpoint
 * so the server can resolve `{countryName}` from the updated player profile.
 */
export function createAirportSendHandler({
  getCountries,
  loadCountries,
  isDestinationLocked,
  lockCountry,
  onRefresh,
  onDestinationSelected,
  send,
}: {
  getCountries: () => readonly CountryOption[];
  loadCountries: () => Promise<readonly CountryOption[]>;
  isDestinationLocked: () => boolean;
  lockCountry: (countryId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onDestinationSelected: () => void;
  send: (text: string) => Promise<boolean>;
}): (text: string) => Promise<boolean> {
  return async (text: string) => {
    if (!isDestinationLocked() && text.trim()) {
      let countries = getCountries();
      if (countries.length === 0) countries = await loadCountries().catch(() => []);
      const matched = matchCountry(text, countries);
      if (matched) {
        try {
          await lockCountry(matched.id);
          await onRefresh().catch(() => undefined);
          onDestinationSelected();
        } catch (error) {
          if (!isAlreadyLockedError(error)) throw error;
          onDestinationSelected();
        }
      }
    }
    return send(text);
  };
}

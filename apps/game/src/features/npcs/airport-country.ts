import { matchCountry } from '@life-abroad/shared';

export type CountryOption = Readonly<{ id: string; name: string }>;
export { matchCountry };

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

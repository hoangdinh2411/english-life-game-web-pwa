const flagUrls = import.meta.glob('../../assets/flags/svg/*.svg', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

export function resolveCountryFlag(isoCode: string): string | undefined {
  return flagUrls[`../../assets/flags/svg/${isoCode.toLocaleLowerCase()}.svg`];
}

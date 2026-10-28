const MONTHS = new Map([
  ['january', 1], ['february', 2], ['march', 3], ['april', 4], ['may', 5], ['june', 6],
  ['july', 7], ['august', 8], ['september', 9], ['october', 10], ['november', 11], ['december', 12],
]);

const naturalDatePatterns = [
  /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})$/i,
  /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i,
  /^(\d{4})\s+([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/i,
] as const;

export function parseIdCardBirthDate(input: string, today = new Date()): string | null {
  const value = input.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  let year: number;
  let month: number;
  let day: number;

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const match = naturalDatePatterns.map(pattern => pattern.exec(value)).find(Boolean);
    if (!match) return null;
    const yearFirst = /^\d{4}\s/.test(value);
    const monthFirst = /^[a-z]/i.test(value);
    year = Number(yearFirst ? match[1] : match[3]);
    month = MONTHS.get(String(yearFirst ? match[2] : monthFirst ? match[1] : match[2]).toLowerCase()) ?? 0;
    day = Number(yearFirst ? match[3] : monthFirst ? match[2] : match[1]);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || month < 1 || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (date.getTime() > todayUtc) return null;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

import * as chrono from 'chrono-node';

const ambiguousNumericDate = /^\s*\d{1,2}[/-]\d{1,2}[/-]\d{4}\s*$/;
const yearFirstEnglishDate = /^(\d{4})\s+([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/i;

export function parseIdCardBirthDate(input: string, today = new Date()): string | null {
  const value = input.trim();
  if (!value || ambiguousNumericDate.test(value)) return null;
  const yearFirst = yearFirstEnglishDate.exec(value);
  const parseable = yearFirst ? `${yearFirst[3]} ${yearFirst[2]} ${yearFirst[1]}` : value;

  const results = chrono.en.GB.parse(parseable, today, { forwardDate: false });
  if (results.length !== 1) return null;
  const parsed = results[0]!.start;
  if (!parsed.isCertain('year') || !parsed.isCertain('month') || !parsed.isCertain('day')) return null;

  const year = parsed.get('year');
  const month = parsed.get('month');
  const day = parsed.get('day');
  if (year === null || month === null || day === null) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (date.getTime() > todayUtc) return null;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

import { randomInt } from 'node:crypto';

export function formatCalendarDate(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const useUtc = value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0 && value.getUTCMilliseconds() === 0;
  const year = (useUtc ? value.getUTCFullYear() : value.getFullYear()).toString().padStart(4, '0');
  const month = ((useUtc ? value.getUTCMonth() : value.getMonth()) + 1).toString().padStart(2, '0');
  const day = (useUtc ? value.getUTCDate() : value.getDate()).toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Creates a 12-digit number with a secure four-digit suffix and gender parity. */
export function generateIdCardNumber(birthDate: Date | string, gender: 'male' | 'female'): string {
  const date = formatCalendarDate(birthDate).replaceAll('-', '');
  const randomSuffix = randomInt(0, 5000);
  const prefix = Math.floor(randomSuffix / 5).toString().padStart(3, '0');
  const parity = gender === 'male' ? 1 : 0;
  const lastDigit = (randomSuffix % 5) * 2 + parity;
  return `${date}${prefix}${lastDigit}`;
}

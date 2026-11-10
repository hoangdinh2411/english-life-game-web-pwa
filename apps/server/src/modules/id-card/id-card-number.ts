import { randomInt } from 'node:crypto';

/** Creates a 12-digit number with a secure four-digit suffix and gender parity. */
export function generateIdCardNumber(birthDate: Date, gender: 'male' | 'female'): string {
  const date = `${birthDate.getUTCFullYear().toString().padStart(4, '0')}${(birthDate.getUTCMonth() + 1).toString().padStart(2, '0')}${birthDate.getUTCDate().toString().padStart(2, '0')}`;
  const randomSuffix = randomInt(0, 5000);
  const prefix = Math.floor(randomSuffix / 5).toString().padStart(3, '0');
  const parity = gender === 'male' ? 1 : 0;
  const lastDigit = (randomSuffix % 5) * 2 + parity;
  return `${date}${prefix}${lastDigit}`;
}

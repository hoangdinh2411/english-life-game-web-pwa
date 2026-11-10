/** Formats a stored 12-digit ID number as YYYYMMDD-XXXX. */
export function formatIdCardNumber(number: string): string {
  if (!/^\d{12}$/.test(number)) throw new Error('ID card number must contain exactly 12 digits');
  return `${number.slice(0, 8)}-${number.slice(8)}`;
}

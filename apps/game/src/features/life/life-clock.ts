export function isDefiniteRejection(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('status' in error)) return false;
  return typeof error.status === 'number' && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429;
}

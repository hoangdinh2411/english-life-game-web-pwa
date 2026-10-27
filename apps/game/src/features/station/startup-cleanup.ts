export function loadWithoutWaitingForCleanup<T>(
  load: () => Promise<T>,
  cleanups: readonly (() => Promise<unknown>)[],
): Promise<T> {
  void Promise.allSettled(cleanups.map(cleanup => cleanup()));
  return load();
}

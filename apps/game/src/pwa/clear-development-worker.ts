// A production worker from a previous preview can otherwise serve its old shell
// on the Vite dev origin. Only remove this app's public cache, never user storage.
export async function clearDevelopmentWorker(
  workers: Pick<ServiceWorkerContainer, 'getRegistrations'>,
  publicCaches: Pick<CacheStorage, 'keys' | 'delete'>,
  origin: string,
): Promise<void> {
  for (const registration of await workers.getRegistrations()) {
    const worker = registration.active ?? registration.waiting ?? registration.installing;
    if (!worker) continue;
    const url = new URL(worker.scriptURL);
    if (url.origin === origin && url.pathname === '/sw.js') await registration.unregister();
  }
  for (const name of await publicCaches.keys()) {
    if (name.startsWith('life-abroad-public-')) await publicCaches.delete(name);
  }
}

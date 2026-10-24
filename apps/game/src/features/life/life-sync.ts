export async function refreshLifeOnConnection(
  online: boolean,
  refreshState: () => Promise<void>,
  refreshCatalog: () => Promise<void>,
): Promise<void> {
  if (!online) return;
  await Promise.allSettled([refreshState(), refreshCatalog()]);
}

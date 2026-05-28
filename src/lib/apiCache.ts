// Deduplicate truly concurrent API requests only (within 50ms window)
// Prevents duplicate simultaneous fetches without blocking real re-fetches

const pendingRequests = new Map<string, { promise: Promise<any>; timestamp: number }>();
const DEDUP_WINDOW_MS = 50;

export async function dedupFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = pendingRequests.get(key);
  const now = Date.now();
  if (existing && now - existing.timestamp < DEDUP_WINDOW_MS) {
    return existing.promise as Promise<T>;
  }
  const promise = fetcher().finally(() => {
    const current = pendingRequests.get(key);
    if (current && current.promise === promise) {
      pendingRequests.delete(key);
    }
  });
  pendingRequests.set(key, { promise, timestamp: now });
  return promise;
}

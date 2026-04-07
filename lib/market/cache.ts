const cache = new Map<string, { data: unknown; expires: number }>();

export function getCached<T>(key: string, keepExpired = false): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expires) {
    if (!keepExpired) {
      cache.delete(key);
    }
    return null;
  }

  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

export function getStaleCached<T>(key: string, maxStaleMs = 6 * 60 * 60 * 1000): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now <= entry.expires) {
    return null;
  }

  if (now - entry.expires > maxStaleMs) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

export const getCachedValue = getCached;
export const setCachedValue = setCache;
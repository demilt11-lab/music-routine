/**
 * Minimal TTL cache abstraction. The default is an in-process Map, which is
 * correct for a single instance and a safe no-op-on-miss across many. To make
 * the cache and rate limiter consistent across a horizontally-scaled fleet,
 * implement this interface against Redis (env.REDIS_URL) and swap it in
 * `getCache()` — no call sites change.
 */
export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  incr(key: string, ttlSeconds: number): Promise<number>;
}

class MemoryCache implements Cache {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | undefined> {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + 1;
    await this.set(key, next, ttlSeconds);
    return next;
  }
}

let cache: Cache | null = null;

export function getCache(): Cache {
  if (!cache) cache = new MemoryCache();
  return cache;
}

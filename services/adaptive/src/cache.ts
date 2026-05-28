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

interface Entry {
  value: unknown;
  expiresAt: number;
}

/**
 * Bounded, self-evicting in-process cache. Without bounds, short-lived keys
 * (e.g. per-user/per-window rate-limit counters) accumulate forever and leak
 * memory. We guard against that two ways:
 *   1. a periodic sweep drops expired entries even if never read again, and
 *   2. a hard size cap evicts the oldest entries (insertion-ordered Map).
 */
class MemoryCache implements Cache {
  private store = new Map<string, Entry>();
  private readonly maxEntries: number;

  constructor(maxEntries = 50_000, sweepIntervalMs = 60_000) {
    this.maxEntries = maxEntries;
    const sweep = setInterval(() => this.sweep(), sweepIntervalMs);
    // Don't keep the event loop alive just for cache maintenance.
    if (typeof sweep.unref === "function") sweep.unref();
  }

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
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictOldest();
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + 1;
    await this.set(key, next, ttlSeconds);
    return next;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt < now) this.store.delete(key);
    }
  }

  private evictOldest(): void {
    // Map preserves insertion order; the first key is the oldest.
    const oldest = this.store.keys().next().value;
    if (oldest !== undefined) this.store.delete(oldest);
  }
}

let cache: Cache | null = null;

export function getCache(): Cache {
  if (!cache) cache = new MemoryCache();
  return cache;
}

import Redis from "ioredis";
import { loadEnv } from "./env.js";

/**
 * Minimal TTL cache abstraction. Two implementations:
 *   - MemoryCache: correct for a single instance (bounded + self-evicting).
 *   - RedisCache: shared across a horizontally-scaled fleet so preference
 *     caching and, critically, rate limiting are consistent across replicas.
 *
 * `getCache()` picks RedisCache when REDIS_URL is set, otherwise MemoryCache.
 * No call site changes between the two.
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
export class MemoryCache implements Cache {
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

/** Structural subset of an ioredis client — lets us unit-test with a fake. */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
}

// Atomic "increment, and set the TTL only on the first hit of the window".
const INCR_WITH_TTL = `
local v = redis.call('INCR', KEYS[1])
if v == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return v`;

/**
 * Redis-backed cache. Every operation degrades gracefully: if Redis is
 * unreachable, reads miss and rate-limit checks fail open (allow) rather than
 * taking the whole service down. ioredis auto-reconnects in the background.
 */
export class RedisCache implements Cache {
  constructor(private redis: RedisClient) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(key);
      return raw == null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      // best-effort cache write
    }
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    try {
      const v = await this.redis.eval(INCR_WITH_TTL, 1, key, ttlSeconds);
      return Number(v);
    } catch {
      return 1; // fail open: never block users because the limiter is down
    }
  }
}

let cache: Cache | null = null;

export function getCache(): Cache {
  if (cache) return cache;
  const { REDIS_URL } = loadEnv();
  cache = REDIS_URL ? new RedisCache(createRedisClient(REDIS_URL)) : new MemoryCache();
  return cache;
}

function createRedisClient(url: string): RedisClient {
  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    // Fail fast instead of queueing while disconnected, so our try/catch can
    // degrade immediately rather than holding requests open.
    enableOfflineQueue: false,
    lazyConnect: false,
  });
  client.on("error", (err: unknown) => {
    console.error("[redis] connection error:", err instanceof Error ? err.message : err);
  });
  return client as unknown as RedisClient;
}

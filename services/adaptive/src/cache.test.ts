import { describe, expect, it } from "vitest";
import { MemoryCache, RedisCache, type RedisClient } from "./cache.js";

class FakeRedis implements RedisClient {
  store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.store.set(key, value);
    return "OK";
  }
  async eval(_script: string, _numKeys: number, key: string | number) {
    const next = Number(this.store.get(String(key)) ?? 0) + 1;
    this.store.set(String(key), String(next));
    return next;
  }
}

const throwingRedis: RedisClient = {
  get: () => Promise.reject(new Error("down")),
  set: () => Promise.reject(new Error("down")),
  eval: () => Promise.reject(new Error("down")),
};

describe("MemoryCache", () => {
  it("round-trips values and increments counters", async () => {
    const c = new MemoryCache();
    await c.set("k", { a: 1 }, 60);
    expect(await c.get<{ a: number }>("k")).toEqual({ a: 1 });
    expect(await c.incr("n", 60)).toBe(1);
    expect(await c.incr("n", 60)).toBe(2);
  });

  it("evicts the oldest entry past the size cap", async () => {
    const c = new MemoryCache(2);
    await c.set("a", 1, 60);
    await c.set("b", 2, 60);
    await c.set("c", 3, 60); // should evict "a"
    expect(await c.get("a")).toBeUndefined();
    expect(await c.get("b")).toBe(2);
    expect(await c.get("c")).toBe(3);
  });

  it("treats expired entries as misses", async () => {
    const c = new MemoryCache();
    await c.set("x", "v", -1); // already expired
    expect(await c.get("x")).toBeUndefined();
  });
});

describe("RedisCache", () => {
  it("serialises through the redis client and increments atomically", async () => {
    const c = new RedisCache(new FakeRedis());
    await c.set("k", { hello: "world" }, 60);
    expect(await c.get<{ hello: string }>("k")).toEqual({ hello: "world" });
    expect(await c.incr("rl", 60)).toBe(1);
    expect(await c.incr("rl", 60)).toBe(2);
  });

  it("degrades gracefully when redis is down", async () => {
    const c = new RedisCache(throwingRedis);
    expect(await c.get("k")).toBeUndefined();
    await expect(c.set("k", 1, 60)).resolves.toBeUndefined();
    expect(await c.incr("rl", 60)).toBe(1); // fail open
  });
});

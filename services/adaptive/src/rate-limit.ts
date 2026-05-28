import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { getCache } from "./cache.js";
import type { AuthContext } from "./auth.js";

/**
 * Fixed-window rate limiter keyed by authenticated user. Backed by the shared
 * cache, so switching the cache to Redis makes this limit fleet-wide.
 */
export function rateLimit(opts: { limit: number; windowSeconds: number; name: string }) {
  return createMiddleware<AuthContext>(async (c, next) => {
    const userId = c.get("userId");
    const window = Math.floor(Date.now() / 1000 / opts.windowSeconds);
    const key = `rl:${opts.name}:${userId}:${window}`;
    const count = await getCache().incr(key, opts.windowSeconds);
    if (count > opts.limit) {
      throw new HTTPException(429, { message: "Rate limit exceeded. Slow down." });
    }
    c.header("X-RateLimit-Limit", String(opts.limit));
    c.header("X-RateLimit-Remaining", String(Math.max(0, opts.limit - count)));
    await next();
  });
}

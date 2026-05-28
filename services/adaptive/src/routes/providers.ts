import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { providerSearchQuerySchema } from "@biomusic/core/contracts";
import { type AuthContext } from "../auth.js";
import { rateLimit } from "../rate-limit.js";
import { getProvider } from "../providers/index.js";

/**
 * GET /v1/providers/:provider/search
 * Server-side proxy for music-provider catalogue search. Keeps provider API
 * keys server-only and gives the client one consistent Track shape regardless
 * of backend.
 */
export const providerRoutes = new Hono<AuthContext>();

providerRoutes.get("/:provider/search", rateLimit({ name: "providers", limit: 90, windowSeconds: 60 }), async (c) => {
  const provider = getProvider(c.req.param("provider"));
  if (!provider) throw new HTTPException(404, { message: "Unknown provider" });
  if (!provider.isConfigured()) throw new HTTPException(503, { message: "Provider not configured" });

  const query = providerSearchQuerySchema.parse(c.req.query());
  const tracks = await provider.search({
    q: query.q,
    limit: query.limit,
    tempo: query.tempoMin != null && query.tempoMax != null ? { min: query.tempoMin, max: query.tempoMax } : undefined,
    energy:
      query.energyMin != null && query.energyMax != null ? { min: query.energyMin, max: query.energyMax } : undefined,
  });
  // Catalogue results depend only on the query, not the user, so they're safe
  // to cache in a shared/CDN layer keyed by URL. `s-maxage` targets the CDN;
  // `max-age` the browser. Configure the edge to cache this path by URL.
  c.header("Cache-Control", "public, max-age=60, s-maxage=600");
  return c.json({ provider: provider.id, tracks });
});

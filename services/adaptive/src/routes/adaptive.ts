import { Hono } from "hono";
import { recommend, type AdaptiveInput } from "@biomusic/core";
import { adaptiveRequestSchema } from "@biomusic/core/contracts";
import { type AuthContext } from "../auth.js";
import { rateLimit } from "../rate-limit.js";
import { getUserPreferences } from "../repository.js";
import { enrichRecommendation } from "../llm.js";
import { getProvider } from "../providers/index.js";

/**
 * POST /v1/adaptive/next
 * Returns the next adaptive recommendation for a live session, plus a small set
 * of candidate tracks matching the recommended feature seeds.
 */
export const adaptiveRoutes = new Hono<AuthContext>();

adaptiveRoutes.post("/next", rateLimit({ name: "adaptive", limit: 120, windowSeconds: 60 }), async (c) => {
  const body = adaptiveRequestSchema.parse(await c.req.json());
  const userId = c.get("userId");

  const preferences = await getUserPreferences(userId);
  const input: AdaptiveInput = {
    activity: body.activity,
    sample: body.sample,
    history: body.history,
    currentTrack: body.currentTrack,
    targetFlowState: body.targetFlowState,
    preferences,
  };

  const rec = recommend(input);

  // Enrich coaching copy with the LLM when explicitly requested (costs a hop).
  if (body.enrich) {
    const enriched = await enrichRecommendation(rec, input);
    rec.reasoning = enriched.reasoning;
    rec.flowPrediction = enriched.flowPrediction;
  }

  // Fetch concrete candidates from the user's available provider (Jamendo by
  // default — always playable). Failures are non-fatal: the recommendation
  // itself is the contract; candidates are best-effort.
  let candidates: Awaited<ReturnType<NonNullable<ReturnType<typeof getProvider>>["search"]>> = [];
  const provider = getProvider("jamendo");
  if (provider?.isConfigured() && rec.action !== "maintain") {
    try {
      candidates = await provider.search({ tempo: rec.seeds.tempo, energy: rec.seeds.energy, limit: 8 });
      const avoid = new Set(rec.seeds.avoidArtists);
      candidates = candidates.filter((t) => !avoid.has(t.artist.trim().toLowerCase()));
    } catch {
      candidates = [];
    }
  }

  return c.json({ recommendation: rec, candidates });
});

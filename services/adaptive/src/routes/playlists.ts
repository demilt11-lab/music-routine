import { Hono } from "hono";
import { getActivityTarget } from "@biomusic/core";
import { playlistGenerateRequestSchema } from "@biomusic/core/contracts";
import { type AuthContext } from "../auth.js";
import { rateLimit } from "../rate-limit.js";
import { curatePlaylist } from "../llm.js";
import { getProvider, listConfiguredProviders } from "../providers/index.js";
import { saveGeneratedPlaylist } from "../repository.js";

/**
 * POST /v1/playlists/generate
 * Builds a curated, persisted playlist for an activity: pull candidates from a
 * provider using the activity's feature envelope, then order them (LLM if
 * available, deterministic otherwise).
 */
export const playlistRoutes = new Hono<AuthContext>();

playlistRoutes.post("/generate", rateLimit({ name: "playlist", limit: 20, windowSeconds: 60 }), async (c) => {
  const body = playlistGenerateRequestSchema.parse(await c.req.json());
  const userId = c.get("userId");

  const target = getActivityTarget(body.activity);
  const providerId = listConfiguredProviders()[0] ?? "jamendo";
  const provider = getProvider(providerId);

  let candidates = [] as Awaited<ReturnType<NonNullable<typeof provider>["search"]>>;
  if (provider?.isConfigured()) {
    // ~3.5 min/track average → fetch enough to fill the requested duration.
    const wanted = Math.min(50, Math.ceil(body.durationMinutes / 3.5) + 5);
    candidates = await provider.search({
      q: body.seedTrack?.artist,
      tempo: target.tempo,
      energy: target.energy,
      limit: wanted,
    });
  }

  const playlist = await curatePlaylist(body, candidates);
  const id = await saveGeneratedPlaylist(userId, { activity: body.activity, ...playlist });

  return c.json({ id, ...playlist });
});

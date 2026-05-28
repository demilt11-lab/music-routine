import type { Track } from "@biomusic/core";
import { loadEnv } from "../env.js";
import { getCache } from "../cache.js";
import { energyTags, type MusicProvider, type SearchParams } from "./index.js";

interface JamendoTrack {
  id: string;
  name: string;
  artist_name: string;
  album_name?: string;
  duration?: number;
  audio?: string;
  image?: string;
}

/**
 * Jamendo — Creative-Commons catalogue with free, streamable audio. Ideal for
 * an MVP: no per-user OAuth, real playable previews, generous free tier.
 */
export const jamendoProvider: MusicProvider = {
  id: "jamendo",

  isConfigured() {
    return Boolean(loadEnv().JAMENDO_CLIENT_ID);
  },

  async search(params: SearchParams): Promise<Track[]> {
    const env = loadEnv();
    if (!env.JAMENDO_CLIENT_ID) return [];

    const url = new URL("https://api.jamendo.com/v3.0/tracks");
    url.searchParams.set("client_id", env.JAMENDO_CLIENT_ID);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(params.limit));
    url.searchParams.set("include", "musicinfo");
    url.searchParams.set("audioformat", "mp32");
    if (params.q) url.searchParams.set("namesearch", params.q);
    const tags = energyTags(params.energy);
    if (tags.length) url.searchParams.set("fuzzytags", tags.join(" "));

    const cacheKey = `jamendo:${url.search}`;
    const cached = await getCache().get<Track[]>(cacheKey);
    if (cached) return cached;

    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: JamendoTrack[] };
    const tracks: Track[] = (data.results ?? []).map((t) => ({
      title: t.name,
      artist: t.artist_name,
      album: t.album_name,
      durationMs: t.duration ? t.duration * 1000 : undefined,
      provider: "jamendo",
      providerTrackId: t.id,
      previewUrl: t.audio,
      artworkUrl: t.image,
    }));

    await getCache().set(cacheKey, tracks, 60 * 30); // catalogue is stable; cache 30m
    return tracks;
  },
};

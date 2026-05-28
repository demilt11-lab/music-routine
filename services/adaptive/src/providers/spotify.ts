import type { Track } from "@biomusic/core";
import { loadEnv } from "../env.js";
import { getCache } from "../cache.js";
import type { MusicProvider, SearchParams } from "./index.js";

interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  preview_url: string | null;
  artists: Array<{ name: string }>;
  album: { name: string; images: Array<{ url: string }> };
}

/**
 * Spotify search via the client-credentials flow — app-level token, no
 * per-user OAuth required for catalogue search. Playback in the client still
 * uses the user's own Spotify session; this endpoint only surfaces candidates.
 */
export const spotifyProvider: MusicProvider = {
  id: "spotify",

  isConfigured() {
    const env = loadEnv();
    return Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);
  },

  async search(params: SearchParams): Promise<Track[]> {
    const token = await getAppToken();
    if (!token) return [];

    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", String(params.limit));
    url.searchParams.set("q", params.q?.trim() || "year:2020-2025");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { tracks?: { items?: SpotifyTrack[] } };
    return (data.tracks?.items ?? []).map((t) => ({
      title: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      album: t.album.name,
      durationMs: t.duration_ms,
      provider: "spotify" as const,
      providerTrackId: t.id,
      previewUrl: t.preview_url ?? undefined,
      artworkUrl: t.album.images[0]?.url,
    }));
  },
};

/** App access token, cached until shortly before expiry. */
async function getAppToken(): Promise<string | null> {
  const env = loadEnv();
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) return null;

  const cached = await getCache().get<string>("spotify:app_token");
  if (cached) return cached;

  const basic = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  await getCache().set("spotify:app_token", json.access_token, (json.expires_in ?? 3600) - 60);
  return json.access_token;
}

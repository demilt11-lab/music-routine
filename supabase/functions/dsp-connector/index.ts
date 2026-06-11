import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SPOTIFY_API  = "https://api.spotify.com/v1";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// ── Spotify token refresh ─────────────────────────────────────
async function refreshSpotifyToken(refreshToken: string): Promise<string> {
  const clientId     = Deno.env.get("SPOTIFY_CLIENT_ID")!;
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")!;
  const basic        = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization:  `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

// ── Spotify playback helpers ──────────────────────────────────
async function spotifyRequest(
  method: string, path: string, accessToken: string, body?: unknown,
): Promise<Response> {
  return fetch(`${SPOTIFY_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function queueTrack(trackUri: string, accessToken: string): Promise<void> {
  const res = await spotifyRequest("POST",
    `/me/player/queue?uri=${encodeURIComponent(trackUri)}`, accessToken);
  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    throw new Error(`Queue failed (${res.status}): ${err}`);
  }
}

async function skipToNext(accessToken: string): Promise<void> {
  const res = await spotifyRequest("POST", "/me/player/next", accessToken);
  if (!res.ok && res.status !== 204) throw new Error(`Skip failed: ${res.status}`);
}

async function setRepeatOff(accessToken: string): Promise<void> {
  await spotifyRequest("PUT", "/me/player/repeat?state=off", accessToken);
}

async function getCurrentPlayback(accessToken: string): Promise<unknown> {
  const res = await spotifyRequest("GET", "/me/player/currently-playing", accessToken);
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`Playback state error: ${res.status}`);
  return res.json();
}

async function setCrossfade(seconds: number, accessToken: string): Promise<void> {
  // Crossfade is a user setting in Spotify; can be surfaced via PUT /me/player but
  // it's not exposed via Web API as of 2026 — we request it as a quality-of-life setting.
  // When Spotify Premium supports it via API, the call is:
  // PUT /me/player with { crossfade_seconds: seconds } — log intent for now.
  console.log(`[dsp-connector] Crossfade requested: ${seconds}s (user setting)`);
}

// ── Main handler ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verify JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });
  }
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body   = await req.json();
    const action = body.action as string; // queue_next | skip | get_playback | status_check

    // Fetch user's Spotify tokens
    const { data: tokenData, error: tokenErr } = await supabase
      .from("music_tokens")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "spotify")
      .single();

    if (tokenErr || !tokenData) {
      return new Response(JSON.stringify({ error: "No Spotify token. Re-connect Spotify." }), {
        status: 403, headers: CORS_HEADERS,
      });
    }

    // Refresh token if needed (stored refresh_token assumed in music_tokens)
    let accessToken = tokenData.music_user_token;
    if (tokenData.refresh_token) {
      try {
        accessToken = await refreshSpotifyToken(tokenData.refresh_token);
        // Update stored access token
        await supabase.from("music_tokens")
          .update({ music_user_token: accessToken, updated_at: new Date().toISOString() })
          .eq("user_id", user.id).eq("provider", "spotify");
      } catch (_) {
        // Use existing token; will fail at Spotify if truly expired
      }
    }

    switch (action) {
      case "queue_next": {
        // C-16: BPM jump validation is done in playlist-engine before this call
        const { track_uri, crossfade_seconds } = body;
        if (!track_uri) throw new Error("track_uri required");
        await queueTrack(track_uri, accessToken);
        if (crossfade_seconds) await setCrossfade(crossfade_seconds, accessToken);
        return new Response(JSON.stringify({ success: true, queued: track_uri }), { headers: CORS_HEADERS });
      }
      case "skip": {
        await skipToNext(accessToken);
        return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS });
      }
      case "get_playback": {
        const state = await getCurrentPlayback(accessToken);
        return new Response(JSON.stringify({ playback: state }), { headers: CORS_HEADERS });
      }
      case "status_check": {
        // C-6: DSP health check — returns error if Spotify not reachable/authed
        const state = await getCurrentPlayback(accessToken);
        const connected = state !== null;
        return new Response(JSON.stringify({ connected, provider: "spotify" }), { headers: CORS_HEADERS });
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: CORS_HEADERS,
        });
    }
  } catch (err) {
    console.error("[dsp-connector] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: CORS_HEADERS,
    });
  }
});

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SPOTIFY_API  = "https://api.spotify.com/v1";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// ── Spotify token refresh ──────────────────────────────────────
async function refreshSpotifyToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
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
  return { access_token: data.access_token, expires_in: data.expires_in ?? 3600 };
}

// ── Spotify playback helpers ──────────────────────────────
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

async function getCurrentPlayback(accessToken: string): Promise<unknown> {
  const res = await spotifyRequest("GET", "/me/player/currently-playing", accessToken);
  if (res.status === 204) return null; // authenticated but nothing playing
  if (!res.ok) throw new Error(`Playback state error: ${res.status}`);
  return res.json();
}

async function getDevices(accessToken: string): Promise<{ id: string; is_active: boolean; name: string }[]> {
  const res = await spotifyRequest("GET", "/me/player/devices", accessToken);
  if (!res.ok) return [];
  const data = await res.json();
  return data.devices ?? [];
}

// CR-3: token refresh is now conditional — only fires when token is within 60s of expiry
async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tokenData: { music_user_token: string; refresh_token: string | null; token_expires_at: string | null },
): Promise<string> {
  const expiresAt = tokenData.token_expires_at
    ? new Date(tokenData.token_expires_at).getTime()
    : 0;
  const needsRefresh = tokenData.refresh_token && Date.now() > expiresAt - 60_000;

  if (!needsRefresh) return tokenData.music_user_token;

  const { access_token, expires_in } = await refreshSpotifyToken(tokenData.refresh_token!);
  await supabase.from("music_tokens").update({
    music_user_token: access_token,
    token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
    updated_at:       new Date().toISOString(),
  }).eq("user_id", userId).eq("provider", "spotify");

  return access_token;
}

// H-7: crossfade is not controllable via Spotify Web API.
// We expose a one-time session-start notification instead of a silent no-op.
// When Spotify adds API support, implement it here.
const CROSSFADE_USER_NOTE =
  "Enable 8-second crossfade in Spotify Settings > Playback for the best reactive transitions.";

// ── Main handler ────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

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
    const action = body.action as string;

    const { data: tokenData, error: tokenErr } = await supabase
      .from("music_tokens")
      .select("music_user_token, refresh_token, token_expires_at")
      .eq("user_id", user.id)
      .eq("provider", "spotify")
      .single();

    if (tokenErr || !tokenData) {
      return new Response(JSON.stringify({ error: "No Spotify token. Re-connect Spotify." }), {
        status: 403, headers: CORS_HEADERS,
      });
    }

    // CR-3: conditional refresh — only when near expiry
    const accessToken = await getValidAccessToken(supabase, user.id, tokenData);

    switch (action) {
      case "queue_next": {
        const { track_uri } = body;
        if (!track_uri) throw new Error("track_uri required");
        // H-7: crossfade_seconds param no longer accepted here — it\'s a Spotify user setting
        await queueTrack(track_uri, accessToken);
        return new Response(JSON.stringify({
          success: true,
          queued: track_uri,
          crossfade_note: CROSSFADE_USER_NOTE,
        }), { headers: CORS_HEADERS });
      }

      case "skip": {
        await skipToNext(accessToken);
        return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS });
      }

      case "get_playback": {
        const state = await getCurrentPlayback(accessToken);
        return new Response(JSON.stringify({ playback: state }), { headers: CORS_HEADERS });
      }

      case "complete_song_play": {
        // H-2: write post-play outcome to session_songs so training signals are captured
        const { session_id, song_id, hr_delta, focus_delta, contributed_to_flow,
                biometric_state_at_end } = body;
        if (!session_id || !song_id) throw new Error("session_id and song_id required");
        await supabase.from("session_songs").update({
          completed:              true,
          hr_delta:               hr_delta   ?? null,
          focus_delta:            focus_delta ?? null,
          contributed_to_flow:    contributed_to_flow ?? false,
          biometric_state_at_end: biometric_state_at_end
            ? JSON.stringify(biometric_state_at_end)
            : null,
        }).eq("session_id", session_id).eq("song_id", song_id);
        return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS });
      }

      case "status_check": {
        // M-5: separate token validity from active playback.
        // A valid token with no active playback still means DSP is connected.
        const devices   = await getDevices(accessToken);
        const hasActive = devices.some((d) => d.is_active);
        return new Response(JSON.stringify({
          connected:         true,        // token is valid — we reached this point
          has_active_device: hasActive,
          active_device:     devices.find((d) => d.is_active)?.name ?? null,
          all_devices:       devices.map((d) => ({ name: d.name, is_active: d.is_active })),
          provider:          "spotify",
          crossfade_note:    CROSSFADE_USER_NOTE,
        }), { headers: CORS_HEADERS });
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

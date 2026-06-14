import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { ORIGIN } from "../_shared/cors.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Web Push VAPID helpers (pure Deno, no npm web-push) ---

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64Url: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Import the VAPID private key as ECDSA P-256
  const rawKey = base64UrlDecode(privateKeyBase64Url);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: base64UrlEncode(rawKey),
    // We need x,y but we'll derive from the public key separately
    // Actually for signing we only need d. Let's import as pkcs8 or jwk with x,y.
  };

  // For ECDSA signing we need the full key. Import raw private key.
  const keyData = await crypto.subtle.importKey(
    "pkcs8",
    buildPkcs8(rawKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyData,
    new TextEncoder().encode(unsignedToken)
  );

  // ECDSA signature from WebCrypto is DER-encoded, convert to raw r||s
  const rawSig = derToRaw(new Uint8Array(signature));
  const encodedSig = base64UrlEncode(rawSig);

  return `${unsignedToken}.${encodedSig}`;
}

// Build PKCS8 wrapper for a raw 32-byte EC private key (P-256)
function buildPkcs8(rawPrivateKey: Uint8Array): ArrayBuffer {
  // PKCS8 header for EC P-256
  const header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);
  // After the key bytes: optional public key tag (we skip it)
  const trailer = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);

  // We need the public key for PKCS8, but we can generate it
  // Actually, a minimal PKCS8 for EC without the public key part:
  const minHeader = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);

  const result = new Uint8Array(minHeader.length + rawPrivateKey.length);
  result.set(minHeader);
  result.set(rawPrivateKey, minHeader.length);
  return result.buffer;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // WebCrypto ECDSA returns raw r||s (64 bytes for P-256), not DER
  // Actually in most implementations it's already raw. Check length.
  if (der.length === 64) return der;

  // Parse DER SEQUENCE
  const raw = new Uint8Array(64);
  let offset = 2; // skip SEQUENCE tag + length
  // r
  const rLen = der[offset + 1];
  offset += 2;
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;
  // s
  const sLen = der[offset + 1];
  offset += 2;
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen < 32 ? 32 + (32 - sLen) : 32;
  raw.set(der.slice(sStart, offset + sLen), sDest);
  return raw;
}

interface PushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendWebPush(
  sub: PushSub,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<Response> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const jwt = await createVapidJwt(audience, "mailto:noreply@biomusic.app", vapidPrivateKey);

  const response = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    },
    body: new TextEncoder().encode(payload),
  });

  return response;
}

// --- Main handler ---

async function handleDigest(admin: any, vapidPublicKey: string, vapidPrivateKey: string) {
  const { data: subscriptions, error: subErr } = await admin
    .rpc("get_decrypted_push_subscriptions");

  if (subErr) throw subErr;
  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, cleaned: 0, users: 0 };
  }

  const userSubs = new Map<string, any[]>();
  for (const sub of subscriptions) {
    const existing = userSubs.get(sub.user_id) || [];
    existing.push(sub);
    userSubs.set(sub.user_id, existing);
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let totalSent = 0;
  let totalCleaned = 0;

  for (const [userId, subs] of userSubs) {
    const { data: sessions } = await admin
      .from("listening_sessions")
      .select("id, started_at, ended_at")
      .eq("user_id", userId)
      .gte("started_at", oneWeekAgo);

    const sessionCount = sessions?.length ?? 0;
    let totalMinutes = 0;
    if (sessions) {
      for (const s of sessions) {
        if (s.started_at && s.ended_at) {
          totalMinutes += Math.round(
            (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000
          );
        }
      }
    }

    const { data: readings } = await admin
      .from("biometric_readings")
      .select("focus_score")
      .eq("user_id", userId)
      .gte("recorded_at", oneWeekAgo)
      .not("focus_score", "is", null);

    let avgFocus: number | null = null;
    if (readings && readings.length > 0) {
      avgFocus = Math.round(readings.reduce((a: number, r: any) => a + (r.focus_score ?? 0), 0) / readings.length);
    }

    let body: string;
    if (sessionCount === 0) {
      body = "You had no sessions last week. Start one today to build your streak! 🎯";
    } else {
      const parts = [`${sessionCount} session${sessionCount > 1 ? "s" : ""}`];
      if (totalMinutes > 0) parts.push(`${totalMinutes} min of focus time`);
      if (avgFocus !== null) parts.push(`avg focus: ${avgFocus}%`);
      body = `Last week: ${parts.join(" · ")}. Keep it up! 🚀`;
    }

    const payload = JSON.stringify({ title: "📊 Your Weekly BioMusic Digest", body, icon: "/app-icon.png" });
    const staleIds: string[] = [];

    for (const sub of subs) {
      try {
        const res = await sendWebPush(sub, payload, vapidPublicKey, vapidPrivateKey);
        if (res.ok) {
          totalSent++;
        } else if (res.status === 410 || res.status === 404) {
          staleIds.push(sub.id);
        } else {
          console.error("Push failed:", res.status, await res.text());
        }
      } catch (err) {
        console.error("Push error for user", userId, err);
      }
    }

    if (staleIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", staleIds);
      totalCleaned += staleIds.length;
    }
  }

  return { sent: totalSent, cleaned: totalCleaned, users: userSubs.size };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const result = await handleDigest(admin, vapidPublicKey, vapidPrivateKey);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Weekly digest error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Shared CORS helpers for FLOWSTATE edge functions.
 *
 * APP_ORIGIN MUST be set in production Supabase secrets.
 * Falls back to localhost:8080 in local dev (where SUPABASE_URL contains 127.0.0.1).
 * Never falls back to "*" — wildcard CORS on authenticated health-data endpoints
 * undermines the same-origin protection for user JWTs and biometric data.
 */

function resolveOrigin(): string {
  const env = Deno.env.get("APP_ORIGIN");
  if (env) return env;
  // Local Supabase dev environment
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost")) {
    return "http://localhost:8080";
  }
  // Configuration error — log and return restrictive value rather than crashing
  console.error("[CORS] APP_ORIGIN is not set. Set it in Supabase Dashboard > Edge Functions > Secrets.");
  return "https://flowstate.app"; // safe restrictive fallback; update to real domain
}

export const ORIGIN = resolveOrigin();

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
};

export function corsOptions(): Response {
  return new Response(null, { headers: CORS_HEADERS });
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

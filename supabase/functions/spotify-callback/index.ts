import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// CR-1: upgraded from deprecated std@0.168.0
// CR-2: APP_ORIGIN read from env — `state` param is a CSRF nonce only, never used for routing

serve(async (req) => {
  const url   = new URL(req.url);
  const code  = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  // `state` carries a CSRF nonce; the redirect target is always the server-configured origin
  const state = url.searchParams.get("state") ?? "";

  // Hard-coded from env — prevents open redirect via crafted `state` values
  const appOrigin  = Deno.env.get("APP_ORIGIN") ?? "http://localhost:5173";
  let   redirectUrl = `${appOrigin}/dashboard`;

  if (code)  redirectUrl += `?spotify_code=${encodeURIComponent(code)}`;
  if (error) redirectUrl += `?spotify_error=${encodeURIComponent(error)}`;
  // Pass state (CSRF nonce) back so the client can validate it
  if (state) redirectUrl += `${redirectUrl.includes("?") ? "&" : "?"}state=${encodeURIComponent(state)}`;

  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl },
  });
});

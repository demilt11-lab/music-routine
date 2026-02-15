import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state') || '';

  // Always redirect back to the app — popup postMessage is unreliable
  // because cross-origin Spotify redirects break window.opener.
  const appOrigin = state || 'http://localhost:5173';
  let redirectUrl = appOrigin + '/dashboard';
  if (code) redirectUrl += '?spotify_code=' + encodeURIComponent(code);
  if (error) redirectUrl += '?spotify_error=' + encodeURIComponent(error);

  return new Response(null, {
    status: 302,
    headers: { 'Location': redirectUrl },
  });
});

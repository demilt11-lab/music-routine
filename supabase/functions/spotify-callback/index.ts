import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state') || '';

  // If state contains an app origin, do a server-side redirect back to the app
  if (state) {
    const redirectUrl = new URL('/dashboard', state);
    if (code) {
      redirectUrl.searchParams.set('spotify_code', code);
    }
    if (error) {
      redirectUrl.searchParams.set('spotify_error', error);
    }
    return new Response(null, {
      status: 302,
      headers: { 'Location': redirectUrl.toString() },
    });
  }

  // Fallback: try postMessage for popup flow
  const html = `<!DOCTYPE html>
<html>
<head><title>Spotify Auth</title></head>
<body>
<script>
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  if (window.opener) {
    window.opener.postMessage({ type: 'spotify-auth', code, error }, '*');
    window.close();
  } else {
    document.body.innerHTML = '<p>Authentication complete. Please return to the app and try again.</p>';
  }
</script>
<p>Connecting to Spotify...</p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
});

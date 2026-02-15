import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  // This page is loaded by the browser after Spotify redirects.
  // It sends the code back to the parent window via postMessage.
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
    // Fallback: store in localStorage and redirect
    if (code) localStorage.setItem('spotify_auth_code', code);
    if (error) localStorage.setItem('spotify_auth_error', error);
    window.location.href = '/dashboard';
  }
</script>
<p>Connecting to Spotify... This window should close automatically.</p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
});

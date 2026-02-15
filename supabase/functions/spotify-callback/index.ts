import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state') || '';

  // state contains the app origin URL for redirect
  const appOrigin = state || '';

  const html = `<!DOCTYPE html>
<html>
<head><title>Spotify Auth</title></head>
<body>
<script>
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  const appOrigin = params.get('state') || '';
  
  if (window.opener) {
    window.opener.postMessage({ type: 'spotify-auth', code, error }, '*');
    window.close();
  } else {
    // Fallback: redirect back to the app with code in hash
    const redirectUrl = appOrigin ? appOrigin + '/dashboard' : '/dashboard';
    const sep = redirectUrl.includes('?') ? '&' : '?';
    if (code) {
      window.location.href = redirectUrl + sep + 'spotify_code=' + encodeURIComponent(code);
    } else {
      window.location.href = redirectUrl + sep + 'spotify_error=' + encodeURIComponent(error || 'unknown');
    }
  }
</script>
<p>Connecting to Spotify... Redirecting...</p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
});

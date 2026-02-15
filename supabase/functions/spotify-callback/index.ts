import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state') || '';

  // Always respond with an HTML page that uses postMessage to communicate
  // back to the opener window, then closes the popup.
  const html = `<!DOCTYPE html>
<html>
<head><title>Spotify Auth</title></head>
<body>
<script>
  var code = ${JSON.stringify(code)};
  var error = ${JSON.stringify(error)};
  var origin = ${JSON.stringify(state)};

  if (window.opener) {
    window.opener.postMessage({ type: 'spotify-auth', code: code, error: error }, origin || '*');
    window.close();
  } else {
    // Fallback: redirect back to the app with the code in query params
    var redirectUrl = (origin || window.location.origin) + '/dashboard';
    if (code) redirectUrl += '?spotify_code=' + encodeURIComponent(code);
    if (error) redirectUrl += '?spotify_error=' + encodeURIComponent(error);
    window.location.href = redirectUrl;
  }
</script>
<p>Connecting to Spotify...</p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
});

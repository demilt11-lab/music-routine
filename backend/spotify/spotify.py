import time
import requests
from typing import Optional, Dict
from config import SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI

# Minimal Spotify helpers: client credentials and authorization code flows.
_token_cache = {"access_token": None, "expires_at": 0}

def _get_client_credentials_token() -> Optional[str]:
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        return None
    if _token_cache["access_token"] and _token_cache["expires_at"] > time.time():
        return _token_cache["access_token"]
    resp = requests.post(
        "https://accounts.spotify.com/api/token",
        data={"grant_type": "client_credentials"},
        auth=(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET),
        timeout=10,
    )
    if resp.status_code != 200:
        return None
    data = resp.json()
    _token_cache["access_token"] = data["access_token"]
    _token_cache["expires_at"] = time.time() + data.get("expires_in", 3600) - 10
    return _token_cache["access_token"]

def search_track(q: str, limit: int = 5):
    token = _get_client_credentials_token()
    if not token:
        return []
    headers = {"Authorization": f"Bearer {token}"}
    params = {"q": q, "type": "track", "limit": limit}
    resp = requests.get("https://api.spotify.com/v1/search", headers=headers, params=params, timeout=10)
    if resp.status_code != 200:
        return []
    items = resp.json().get("tracks", {}).get("items", [])
    results = []
    for it in items:
        results.append({
            "spotify_id": it["id"],
            "title": it["name"],
            "artist": ", ".join([a["name"] for a in it.get("artists", [])]),
            "url": it["external_urls"].get("spotify"),
        })
    return results

def build_authorize_url(state: str, scopes: str = "user-read-private user-read-email playlist-modify-public") -> Optional[str]:
    """
    Return a Spotify authorization URL for the Authorization Code flow.
    state: opaque value your app uses to verify the response (server-side nonce)
    """
    if not SPOTIFY_CLIENT_ID:
        return None
    from urllib.parse import urlencode
    params = {
        "client_id": SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "scope": scopes,
        "state": state,
        "show_dialog": "true",
    }
    url = "https://accounts.spotify.com/authorize?" + urlencode(params)
    return url

def exchange_code_for_token(code: str) -> Optional[Dict]:
    """
    Exchange an authorization code for access and refresh tokens.
    Returns dict with access_token, refresh_token, expires_in (seconds), or None.
    """
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        return None
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": SPOTIFY_REDIRECT_URI,
    }
    resp = requests.post(
        "https://accounts.spotify.com/api/token",
        data=data,
        auth=(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET),
        timeout=10,
    )
    if resp.status_code != 200:
        return None
    return resp.json()

def refresh_access_token(refresh_token: str) -> Optional[Dict]:
    """
    Use a refresh token to obtain a new access token.
    Returns dict with access_token and expires_in (and possibly refresh_token), or None.
    """
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        return None
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    resp = requests.post(
        "https://accounts.spotify.com/api/token",
        data=data,
        auth=(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET),
        timeout=10,
    )
    if resp.status_code != 200:
        return None
    return resp.json()

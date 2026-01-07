from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
import crud, schemas
from auth_utils import create_access_token, get_db, get_current_user
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse, HTMLResponse, JSONResponse
import spotify as spotify_client
import secrets
from typing import Optional
import time

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=schemas.UserOut)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = crud.get_user_by_username(db, user_in.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    user = crud.create_user(db, user_in.username, user_in.password)
    return user

@router.post("/token", response_model=schemas.Token)
def token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(subject=user.username)
    return {"access_token": access_token, "token_type": "bearer"}

# --- Spotify Authorization Code Flow endpoints with server-side state nonces ---

@router.get("/spotify/login-url")
def spotify_login_url(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Creates a server-side state (nonce), stores it in DB associated to current_user.username,
    and returns the Spotify authorization URL that includes that state.
    The client (frontend) should open the returned URL to start the Spotify auth flow.
    """
    username = current_user.username
    # create a secure random state value
    state = secrets.token_urlsafe(32)
    # store server-side (expires in 5 minutes)
    crud.create_spotify_state(db, username, state, expires_in_seconds=300)
    url = spotify_client.build_authorize_url(state=state)
    if not url:
        raise HTTPException(status_code=500, detail="Spotify not configured on server")
    return {"url": url, "state": state}

@router.get("/spotify/connect")
def spotify_connect_page():
    """
    Simple HTML page to start Spotify login. For convenience when testing locally,
    the page asks you to paste your app JWT token (from /auth/token) and then it will
    call /auth/spotify/login-url with the Authorization header and open the Spotify consent page.
    """
    html = """
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Connect Spotify</title>
      </head>
      <body>
        <h2>Connect Spotify</h2>
        <p>Paste your app access token from <code>/auth/token</code> below and click Connect.</p>
        <input id="token" style="width:80%" placeholder="Token (paste only the token text)" />
        <button id="btn">Connect</button>
        <p id="status"></p>
        <script>
          document.getElementById('btn').addEventListener('click', async () => {
            const token = document.getElementById('token').value.trim();
            if (!token) { alert('Please paste your token'); return; }
            document.getElementById('status').textContent = 'Requesting Spotify login URL...';
            try {
              const resp = await fetch('/auth/spotify/login-url', {
                headers: { 'Authorization': 'Bearer ' + token }
              });
              if (!resp.ok) {
                const txt = await resp.text();
                document.getElementById('status').textContent = 'Error: ' + txt;
                return;
              }
              const data = await resp.json();
              // open Spotify consent in a new window/tab
              window.open(data.url, '_blank');
              document.getElementById('status').textContent = 'Opened Spotify consent page in new tab. Complete consent to finish.';
            } catch (err) {
              document.getElementById('status').textContent = 'Fetch error: ' + err;
            }
          });
        </script>
      </body>
    </html>
    """
    return HTMLResponse(content=html)

@router.get("/callback")
def spotify_callback(code: Optional[str] = Query(None), state: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """
    Spotify redirects here after user consents. We look up the server-side state, map to username,
    exchange the code for tokens, save them to the user, and remove the state entry.
    """
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state in callback")
    # lookup server-side state
    st = crud.get_spotify_state(db, state)
    if not st:
        raise HTTPException(status_code=400, detail="Invalid or expired state")
    username = st.username
    # exchange code for tokens
    token_data = spotify_client.exchange_code_for_token(code)
    if not token_data:
        raise HTTPException(status_code=400, detail="Failed to exchange code for token with Spotify")
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in")
    saved = crud.save_spotify_tokens(db, username, access_token, refresh_token, expires_in)
    # delete the used state (single-use)
    crud.delete_spotify_state(db, state)
    if not saved:
        raise HTTPException(status_code=404, detail="User for provided state not found")
    # Simple HTML page that closes itself (useful when opened in new tab)
    html = f"""
    <html>
      <head><title>Spotify Connected</title></head>
      <body>
        <h2>Spotify connected for user: {username}</h2>
        <p>You can close this window and return to the app.</p>
        <script>
          setTimeout(() => window.close(), 2000);
        </script>
      </body>
    </html>
    """
    return HTMLResponse(content=html)

@router.post("/spotify/refresh", response_class=JSONResponse)
def spotify_refresh(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Refresh the Spotify access token for the current user using the stored refresh token.
    Returns the new access token expiry info on success.
    """
    user = current_user
    if not user.spotify_refresh_token:
        raise HTTPException(status_code=400, detail="No refresh token stored for user")
    token_data = spotify_client.refresh_access_token(user.spotify_refresh_token)
    if not token_data:
        raise HTTPException(status_code=400, detail="Failed to refresh token with Spotify")
    access_token = token_data.get("access_token")
    # Spotify may return a new refresh_token or not
    new_refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in")
    saved = crud.save_spotify_tokens(db, user.username, access_token, new_refresh_token, expires_in)
    if not saved:
        raise HTTPException(status_code=500, detail="Failed to save refreshed tokens")
    return {"access_token_expires_in": expires_in, "saved_for_user": user.username}

@router.get("/spotify/token-info")
def spotify_token_info(current_user = Depends(get_current_user)):
    """
    Return masked token metadata for the current logged-in user.
    Does not expose full tokens.
    """
    user = current_user
    if not user.spotify_access_token and not user.spotify_refresh_token:
        raise HTTPException(status_code=404, detail="No Spotify tokens stored for user")
    def mask(tok: Optional[str]) -> Optional[str]:
        if not tok:
            return None
        if len(tok) <= 10:
            return tok[:3] + "..." + tok[-3:]
        return tok[:6] + "..." + tok[-4:]
    info = {
        "has_access_token": bool(user.spotify_access_token),
        "access_token_masked": mask(user.spotify_access_token),
        "has_refresh_token": bool(user.spotify_refresh_token),
        "refresh_token_masked": mask(user.spotify_refresh_token),
        "access_token_expires_at": user.spotify_expires_at,
        "access_token_expires_in_seconds": None
    }
    if user.spotify_expires_at:
        import time
        info["access_token_expires_in_seconds"] = max(0, int(user.spotify_expires_at) - int(time.time()))
    return JSONResponse(content=info)

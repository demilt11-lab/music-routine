# External Accounts & Credentials — Setup Guide

This lists **only the services the code actually reads** today, where to get each
credential, and where to paste it. Anything not on this page (Garmin, WHOOP,
Oura, Fitbit, Polar, Apple Music, Emotiv, Pinecone, …) appears in
`.env.example` as a placeholder for future work — **getting those keys now does
nothing**, because no code consumes them yet.

There are two places credentials live:

- **Client env** (`VITE_*`) — baked into the web build. Set these where you host
  the frontend (Vercel/Netlify project settings, or `.env` for local `bun dev`).
  Safe to expose (publishable/anon keys only).
- **Server secrets** — read by Supabase Edge Functions via `Deno.env.get(...)`.
  Set with `supabase secrets set NAME=value` or in the Supabase Dashboard →
  Edge Functions → Secrets. **Never** put these in client env.

---

## 1. Supabase — REQUIRED (you already have this)

The backend. Without it nothing runs.

- **Where:** https://supabase.com/dashboard → your project → **Settings → API**
- **Copy:**
  - Project URL → `VITE_SUPABASE_URL` (client) **and** `SUPABASE_URL` (server)
  - `anon` / publishable key → `VITE_SUPABASE_PUBLISHABLE_KEY` (client) **and**
    `SUPABASE_ANON_KEY` (server)
  - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server only — never client)
- Apply migrations: `supabase db push` (or run `supabase/migrations/*.sql` in order).

---

## 2. Spotify — REQUIRED for the core music feature

Playback + the reactive engine's track selection run through Spotify.

- **Where:** https://developer.spotify.com/dashboard → log in → **Create app**
- **App settings:**
  - Add a **Redirect URI** (exact, no trailing slash):
    `https://YOUR_DOMAIN/spotify-callback`
    For local dev also add `http://localhost:5173/spotify-callback`.
  - Under APIs, enable **Web Playback SDK** and **Web API**.
- **Copy:**
  - Client ID → `SPOTIFY_CLIENT_ID` (server)
  - Client secret → `SPOTIFY_CLIENT_SECRET` (server)
- **Scopes** the app requests (already coded — nothing to configure, listed for
  your review): `streaming`, `user-read-playback-state`,
  `user-modify-playback-state`, `user-read-currently-playing`,
  `user-library-read`, `user-library-modify`, `user-read-email`,
  `user-read-private`, `playlist-read-private`, `playlist-read-collaborative`.
- **Note:** the Web Playback SDK requires each **end user** to have **Spotify
  Premium**. Your developer app doesn't need Premium to exist, but users without
  it fall back to 30-second previews.
- **Note:** new Spotify apps start in *Development Mode* (max 25 allow-listed
  users). Submit the quota-extension request when you go public.

---

## 3. Heart-rate strap / Muse EEG / Apple Watch — NO ACCOUNT NEEDED

These connect on the device, not via a cloud key:

- **BLE heart-rate straps** (Polar H10, Wahoo, etc.) — pair directly via Web
  Bluetooth in Chrome/Edge/Android. Real HRV (RMSSD/SDNN) is parsed from the
  strap's RR intervals. Nothing to register.
- **Muse EEG headband** — also Web Bluetooth, device-side. (`MUSE_APP_ID` in
  `.env.example` is for Muse's *cloud* SDK, which we don't use.)
- **Apple Watch** — via HealthKit in the native iOS (Capacitor) build; governed
  by the app's HealthKit entitlement in Xcode, not an API key.

---

## 4. Web Push (VAPID) — OPTIONAL, self-generated (no account)

Powers session/flow push notifications. You generate the keypair yourself:

```bash
npx web-push generate-vapid-keys
```

- Public key → `VAPID_PUBLIC_KEY` (server)
- Private key → `VAPID_PRIVATE_KEY` (server)

If unset, the `get-vapid-key` function returns 500 and push silently stays off —
the rest of the app is unaffected.

---

## 5. Jamendo — OPTIONAL (free-music fallback; default key baked in)

Royalty-free catalog used when Spotify has no match. A shared demo client ID is
already hard-coded as a fallback, so this works out of the box. For your own
quota:

- **Where:** https://devportal.jamendo.com/ → sign up → register an app
- **Copy:** Client ID → `JAMENDO_CLIENT_ID` (server)

---

## 6. Lovable AI — OPTIONAL (legacy LLM suggestions)

Only the older `adaptive-music` / `generate-playlist` suggestion path uses this.
The deterministic reactive engine does **not** need it. If you deploy on
[Lovable](https://lovable.dev), the key is provided by the platform.

- **Copy:** `LOVABLE_API_KEY` (server). If unset, those two functions return an
  error but the engine, sessions, and playback keep working.

---

## 7. Sentry — OPTIONAL (error monitoring)

- **Where:** https://sentry.io → create a project (platform: **React**)
- **Copy:** DSN → `VITE_SENTRY_DSN` (client). Unset = monitoring no-ops.

---

## 8. APP_ORIGIN — your own domain (not an external account)

- `APP_ORIGIN` (server) = your deployed frontend URL, e.g.
  `https://flowstate.yourdomain.com`. Used to lock CORS and to build the
  OAuth redirect target. If unset, CORS falls back to `*` (fine for local dev,
  tighten for production).

---

## Quick checklist

| Service        | Needed?            | Get it at                                   | Vars |
|----------------|--------------------|---------------------------------------------|------|
| Supabase       | **Required**       | supabase.com/dashboard → Settings → API     | `(VITE_)SUPABASE_URL`, `(VITE_)SUPABASE_*KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Spotify        | **Required (music)** | developer.spotify.com/dashboard           | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` |
| HR/EEG/Watch   | No account         | device-side (Web Bluetooth / HealthKit)     | — |
| VAPID push     | Optional           | `npx web-push generate-vapid-keys`          | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| Jamendo        | Optional           | devportal.jamendo.com                       | `JAMENDO_CLIENT_ID` |
| Lovable AI     | Optional           | lovable.dev (platform-provided)             | `LOVABLE_API_KEY` |
| Sentry         | Optional           | sentry.io                                   | `VITE_SENTRY_DSN` |
| Your domain    | Required (prod)    | your host                                   | `APP_ORIGIN` |

**Minimum to boot a working app with live music: Supabase + Spotify.** Everything
else is additive.

### Setting server secrets

```bash
supabase secrets set SPOTIFY_CLIENT_ID=xxxx SPOTIFY_CLIENT_SECRET=xxxx \
  APP_ORIGIN=https://your-domain VAPID_PUBLIC_KEY=xxxx VAPID_PRIVATE_KEY=xxxx
supabase functions deploy   # redeploy so functions pick up new secrets
```

(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected
into Edge Functions automatically — you don't set those by hand.)

# BioMusic

**BioMusic** adapts your music in real-time using biometric data — heart rate, brainwaves, and stress levels — to help you reach your optimal flow state during workouts, study sessions, sleep, and more.

---

## Features

- 🎵 **Adaptive Playlists** — AI-generated playlists that update based on your current biometric state
- 💓 **Biometric Integration** — Apple Watch (HealthKit), Muse EEG headband, and Web Bluetooth support
- 📊 **Session Tracking** — Log every listening session with mood, activity type, and song-level feedback
- 📈 **Weekly & Monthly Insights** — Progress charts, streak tracking, and personalised recommendations
- 🔔 **Smart Notifications** — Flow state alerts and weekly digest emails
- 📱 **PWA + Capacitor** — Installable on iOS and Android, works offline
- 🎧 **Multi-Source Music** — Spotify, Jamendo (royalty-free), local files, and YouTube Music

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | shadcn/ui + Tailwind CSS |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| Mobile | Capacitor (iOS / Android) |
| PWA | vite-plugin-pwa + Workbox |
| Package manager | Bun |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) `>= 1.0` (or Node.js `>= 20`)
- A [Supabase](https://supabase.com) project
- (Optional) Spotify Developer app for Spotify integration

### 1. Clone the repo

```sh
git clone https://github.com/demilt11-lab/music-routine.git
cd music-routine
```

### 2. Install dependencies

```sh
bun install
```

### 3. Configure environment variables

```sh
cp .env.example .env
```

Open `.env` and fill in the values (see [Environment Variables](#environment-variables) below).

### 4. Apply database migrations

```sh
bunx supabase db push
```

Or apply the SQL files in `supabase/migrations/` manually via the Supabase SQL editor.

### 5. Start the dev server

```sh
bun run dev
```

The app runs at `http://localhost:8080`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in every value. **Never commit `.env` with real credentials.**

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase anon/public key (safe for browser) |
| `VITE_SPOTIFY_CLIENT_ID` | Optional | Spotify app client ID (enables Spotify integration) |
| `VITE_SENTRY_DSN` | Optional | Sentry DSN for error tracking |

### Supabase Edge Function Secrets

Set these in the [Supabase dashboard](https://supabase.com/dashboard) → Edge Functions → Manage Secrets:

| Secret | Description |
|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key |

---

## Database Migrations

All migrations are in `supabase/migrations/`. Apply in chronological order. The latest migration (`20260610120000_investor_demo_hardening.sql`) is required for production.

To run a scheduled cleanup of orphaned sessions, wire up the `cleanup_orphan_sessions()` function using Supabase's pg_cron scheduler (see `supabase/migrations/20260611_cron_setup.sql`).

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full go-live checklist.

**Quick deploy via Lovable:** Open your project in [Lovable](https://lovable.dev) and click **Share → Publish**.

**Custom domain:** Project → Settings → Domains → Connect Domain.

---

## Project Structure

```
src/
  pages/          # Route-level page components
  components/     # Reusable UI components
  hooks/          # Custom React hooks (data fetching, device APIs)
  integrations/   # Supabase client + generated types
  lib/            # Utility functions
supabase/
  functions/      # Edge Functions (Spotify auth, adaptive music, push)
  migrations/     # Ordered SQL migrations
public/
  sw.js           # Service worker
  manifest.json   # PWA manifest
```

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit your changes
4. Open a pull request against `main`

All PRs run the CI pipeline (lint + typecheck + tests) automatically.

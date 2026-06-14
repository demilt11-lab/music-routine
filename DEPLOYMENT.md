# BioMusic — Deployment Checklist

Use this checklist before every production release.

---

## 🔴 Pre-Launch (Blocking)

### Credentials & Secrets
- [ ] Rotate Supabase anon key (if previously exposed) and update in hosting env vars
- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel / Netlify / Lovable environment settings — not in the repo
- [ ] Set `SPOTIFY_CLIENT_SECRET`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `JAMENDO_CLIENT_ID`, `APP_ORIGIN` as Supabase Edge Function secrets (`supabase secrets set KEY=value`)
- [ ] Verify `.env` is NOT tracked by git (`git ls-files .env` should return nothing)

### Database
- [ ] Apply all migrations in `supabase/migrations/` to production (run `bunx supabase db push` or apply via SQL editor)
- [ ] Confirm `onboarding_completed`, `confidence`, and `signal_quality` columns exist on their respective tables
- [ ] Wire up `cleanup_orphan_sessions()` as a pg_cron job (see below)

### Spotify OAuth
- [ ] Add production domain to Spotify app **Redirect URIs** in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
  - Format: `https://YOUR_DOMAIN/settings` (or wherever the callback lands)
  - Also add your Supabase edge function callback URL

### PWA
- [ ] Confirm `public/sw.js` is served at the root path
- [ ] Verify `manifest.json` icons resolve (check `/icons/icon-192x192.png` and `/icons/icon-512x512.png`)
- [ ] Test "Add to Home Screen" flow on iOS Safari and Android Chrome

---

## 🟡 High Priority (Ship Within Days)

### Error Monitoring
- [ ] Create a [Sentry](https://sentry.io) project
- [ ] Add `VITE_SENTRY_DSN` to hosting environment variables
- [ ] Verify errors are appearing in the Sentry dashboard after first real user session

### CI/CD
- [ ] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as GitHub Actions secrets (Settings → Secrets → Actions)
- [ ] Confirm the CI workflow passes on `main`: lint ✅ typecheck ✅ tests ✅

### Weekly Digest
- [ ] Schedule the `weekly-digest` edge function via Supabase cron (every Monday 9am UTC recommended)

---

## pg_cron Setup (Orphan Session Cleanup)

Run this once in the Supabase SQL editor to schedule the cleanup function:

```sql
-- Enable pg_cron extension (if not already enabled)
create extension if not exists pg_cron;

-- Schedule cleanup_orphan_sessions() to run daily at 3am UTC
select cron.schedule(
  'cleanup-orphan-sessions',
  '0 3 * * *',
  $$select public.cleanup_orphan_sessions()$$
);

-- Schedule weekly digest every Monday at 9am UTC
-- (triggers the weekly-digest edge function via pg_net or a Supabase cron)
select cron.schedule(
  'weekly-digest',
  '0 9 * * 1',
  $$select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )$$
);
```

---

## Post-Launch

- [ ] Monitor Sentry for the first 48 hours
- [ ] Verify push notifications are delivering end-to-end
- [ ] Check Supabase dashboard for any RLS policy violations in the logs
- [ ] Tag the release in git: `git tag v1.0.0 && git push --tags`

-- ============================================================
-- BioMusic — pg_cron Scheduled Jobs
-- Apply this ONCE in the Supabase SQL editor after enabling
-- the pg_cron extension in your project.
-- ============================================================

-- Enable pg_cron (safe to run even if already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── 1. Orphan session cleanup: daily at 3am UTC ──────────────────────────────
-- Closes sessions that were started but never ended after 24 hours.
select cron.schedule(
  'cleanup-orphan-sessions',
  '0 3 * * *',
  $$select public.cleanup_orphan_sessions()$$
);

-- ── 2. Weekly digest: every Monday at 9am UTC ────────────────────────────────
-- Triggers the weekly-digest Supabase Edge Function for all active users.
-- Requires pg_net extension and SUPABASE_URL + SUPABASE_ANON_KEY app settings.
select cron.schedule(
  'weekly-digest-email',
  '0 9 * * 1',
  $$
  select net.http_post(
    url        := current_setting('app.supabase_url', true)
                   || '/functions/v1/weekly-digest',
    headers    := jsonb_build_object(
      'Authorization', 'Bearer '
        || current_setting('app.supabase_anon_key', true),
      'Content-Type', 'application/json'
    ),
    body       := '{}'::jsonb
  )
  $$
);

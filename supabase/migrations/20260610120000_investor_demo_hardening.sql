-- ============================================================
-- BioMusic — Investor Demo Hardening Migration
-- Full engineering audit pass — June 2026
-- ============================================================

-- --------------------------------------------------------
-- 1. Add onboarding_completed to profiles
--    (FIX BUG-005: replaces localStorage-based gate)
-- --------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- --------------------------------------------------------
-- 2. biometric_readings — add confidence + signal_quality
--    columns if the table already exists from a prior migration
-- --------------------------------------------------------
ALTER TABLE public.biometric_readings
  ADD COLUMN IF NOT EXISTS confidence      TEXT    NOT NULL DEFAULT 'simulated'
    CHECK (confidence IN ('high', 'medium', 'low', 'simulated')),
  ADD COLUMN IF NOT EXISTS signal_quality  INTEGER          DEFAULT 100
    CHECK (signal_quality BETWEEN 0 AND 100);

-- --------------------------------------------------------
-- 3. user_music_preferences — per-user, per-activity
--    learned preferences from track feedback
--    (closes the personalization feedback loop)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_music_preferences (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type       TEXT        NOT NULL,
  preferred_tempo_avg NUMERIC(6,2),
  preferred_energy_avg NUMERIC(4,3),
  skip_rate           NUMERIC(4,3) DEFAULT 0,
  like_count          INTEGER     DEFAULT 0,
  skip_count          INTEGER     DEFAULT 0,
  session_count       INTEGER     DEFAULT 0,
  last_updated        TIMESTAMPTZ DEFAULT now(),
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, activity_type)
);

ALTER TABLE public.user_music_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences" ON public.user_music_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_music_prefs_user_activity
  ON public.user_music_preferences (user_id, activity_type);

-- --------------------------------------------------------
-- 4. Function: upsert_music_preference
--    Called after track feedback to update rolling averages
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_music_preference(
  p_user_id       UUID,
  p_activity_type TEXT,
  p_tempo         NUMERIC,
  p_energy        NUMERIC,
  p_feedback      TEXT  -- 'up' or 'down'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_like_inc  INTEGER := CASE WHEN p_feedback = 'up'   THEN 1 ELSE 0 END;
  v_skip_inc  INTEGER := CASE WHEN p_feedback = 'down' THEN 1 ELSE 0 END;
BEGIN
  INSERT INTO public.user_music_preferences (
    user_id, activity_type,
    preferred_tempo_avg, preferred_energy_avg,
    like_count, skip_count, session_count, last_updated
  )
  VALUES (
    p_user_id, p_activity_type,
    CASE WHEN p_feedback = 'up' THEN p_tempo ELSE NULL END,
    CASE WHEN p_feedback = 'up' THEN p_energy ELSE NULL END,
    v_like_inc, v_skip_inc, 1, now()
  )
  ON CONFLICT (user_id, activity_type) DO UPDATE SET
    -- Rolling average for liked tracks only
    preferred_tempo_avg = CASE
      WHEN p_feedback = 'up' AND p_tempo IS NOT NULL THEN
        COALESCE(
          (user_music_preferences.preferred_tempo_avg * user_music_preferences.like_count + p_tempo)
            / NULLIF(user_music_preferences.like_count + 1, 0),
          p_tempo
        )
      ELSE user_music_preferences.preferred_tempo_avg
    END,
    preferred_energy_avg = CASE
      WHEN p_feedback = 'up' AND p_energy IS NOT NULL THEN
        COALESCE(
          (user_music_preferences.preferred_energy_avg * user_music_preferences.like_count + p_energy)
            / NULLIF(user_music_preferences.like_count + 1, 0),
          p_energy
        )
      ELSE user_music_preferences.preferred_energy_avg
    END,
    like_count    = user_music_preferences.like_count    + v_like_inc,
    skip_count    = user_music_preferences.skip_count    + v_skip_inc,
    session_count = user_music_preferences.session_count + 1,
    skip_rate     = CAST(
      (user_music_preferences.skip_count + v_skip_inc) AS NUMERIC
    ) / NULLIF(user_music_preferences.session_count + 1, 0),
    last_updated  = now();
END;
$$;

-- --------------------------------------------------------
-- 5. Orphan session cleanup
--    Sessions started but never ended after 24 hours
--    Run this on a Supabase cron or pg_cron schedule
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_orphan_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.listening_sessions
  SET
    ended_at = started_at + INTERVAL '1 hour',
    notes    = COALESCE(notes, '') || ' [auto-closed: session orphaned]'
  WHERE
    ended_at  IS NULL
    AND started_at < now() - INTERVAL '24 hours';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- --------------------------------------------------------
-- 6. RLS: ensure session_songs allows UPDATE by owner
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own session songs" ON public.session_songs;

CREATE POLICY "Users can update own session songs"
  ON public.session_songs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.listening_sessions ls
      WHERE ls.id = session_songs.session_id
        AND ls.user_id = auth.uid()
    )
  );

-- --------------------------------------------------------
-- 7. Index: biometric_readings session + time lookups
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_biometric_readings_session_time
  ON public.biometric_readings (session_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_biometric_readings_user_time
  ON public.biometric_readings (user_id, recorded_at DESC);

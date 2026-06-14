-- QA Certification Fixes
-- Addresses: GDPR export completeness, auth guard on export_user_data, biometric purge cron

-- ── 1. Fix export_user_data: remove 90-day window, add auth.uid() guard ──────
-- GDPR Article 20 requires COMPLETE portable copy of all data held.
-- Previous version limited biometric export to 90 days — non-compliant.
-- Auth guard prevents any authenticated user from exporting another user's data.

CREATE OR REPLACE FUNCTION public.export_user_data(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile  JSONB;
  v_sessions JSONB;
  v_bio      JSONB;
  v_prefs    JSONB;
  v_songs    JSONB;
BEGIN
  -- Auth guard: only the data owner may export their own data when called
  -- with authenticated role. service_role bypass is intentional for admin ops.
  IF current_setting('role') <> 'service_role' AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Access denied: you may only export your own data'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT row_to_json(p)::JSONB INTO v_profile FROM (
    SELECT id, display_name, age, created_at,
           biometric_consent_granted_at, biometric_consent_version
    FROM public.profiles WHERE id = p_user_id
  ) p;

  SELECT jsonb_agg(row_to_json(s)) INTO v_sessions FROM (
    SELECT id, activity_type, started_at, ended_at, duration_minutes,
           flow_score, avg_heart_rate, avg_hrv
    FROM public.listening_sessions
    WHERE user_id = p_user_id
    ORDER BY started_at DESC
  ) s;

  -- Full biometric history (no date cap — GDPR Article 20 requires completeness)
  SELECT jsonb_agg(row_to_json(b)) INTO v_bio FROM (
    SELECT recorded_at, heart_rate, hrv_rmssd, blood_oxygen, respiratory_rate,
           stress_level, focus_score, device_type, confidence, signal_quality
    FROM public.biometric_readings
    WHERE user_id = p_user_id
    ORDER BY recorded_at DESC
    LIMIT 1000000  -- hard cap as memory safety; real-world 2yr limit is ~315k rows at 5min intervals
  ) b;

  SELECT jsonb_agg(row_to_json(p2)) INTO v_prefs FROM (
    SELECT activity_type, avg_tempo, avg_energy, skip_rate,
           preferred_genres, updated_at
    FROM public.user_music_preferences
    WHERE user_id = p_user_id
  ) p2;

  SELECT jsonb_agg(row_to_json(ss)) INTO v_songs FROM (
    SELECT ss.played_at, ss.rating, s.title, s.artist, s.tempo, s.energy
    FROM public.session_songs ss
    JOIN public.listening_sessions ls ON ls.id = ss.session_id
    JOIN public.songs s ON s.id = ss.song_id
    WHERE ls.user_id = p_user_id
    ORDER BY ss.played_at DESC
  ) ss;

  RETURN jsonb_build_object(
    'export_version', '2',
    'exported_at',    NOW(),
    'user_id',        p_user_id,
    'profile',        COALESCE(v_profile, 'null'::JSONB),
    'sessions',       COALESCE(v_sessions, '[]'::JSONB),
    'biometric_readings', COALESCE(v_bio, '[]'::JSONB),
    'music_preferences',  COALESCE(v_prefs, '[]'::JSONB),
    'session_songs',      COALESCE(v_songs, '[]'::JSONB)
  );
END;
$$;

-- Re-grant (function was replaced)
GRANT EXECUTE ON FUNCTION public.export_user_data(UUID) TO authenticated;

-- ── 2. Schedule biometric purge cron (was commented out in prior migration) ──
-- Runs every Sunday at 03:00 UTC. Deletes biometric_readings older than 2 years.
-- Requires pg_cron extension (already enabled via supabase/config.toml).

SELECT cron.schedule(
  'flowstate-bio-purge',
  '0 3 * * 0',
  $$SELECT public.purge_expired_biometric_data()$$
);

-- ── 3. Persist healthkit_consent_granted_at when HealthKit consent is given ──
-- Previously, the HealthKit checkbox was captured in UI but never persisted.
-- The edge-function grant_biometric_consent now accepts a healthkit_consent flag.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS healthkit_consent_granted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.healthkit_consent_granted_at
  IS 'Timestamp when user explicitly consented to HealthKit data collection. NULL = not consented.';

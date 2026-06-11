-- ============================================================
-- FLOWSTATE COMPLIANCE MIGRATION 001
-- C-1  Biometric consent capture + DB-level trigger enforcement
-- C-4  GDPR/CCPA full cascading data deletion
-- C-5  GDPR Article 20 portable data export
-- C-7  2-year raw biometric data retention enforcement
-- ============================================================

-- ── C-1: Add consent columns to profiles ──────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS biometric_consent_granted_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS biometric_consent_version            TEXT DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS data_processing_consent_granted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS healthkit_consent_granted_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_ip_hash                      TEXT,   -- SHA-256 of IP only
  ADD COLUMN IF NOT EXISTS gdpr_region                          BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.check_biometric_consent(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ts TIMESTAMPTZ;
BEGIN
  SELECT biometric_consent_granted_at INTO v_ts FROM public.profiles WHERE id = p_user_id;
  RETURN v_ts IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_biometric_consent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.check_biometric_consent(NEW.user_id) THEN
    RAISE EXCEPTION 'Biometric consent required. User % has not granted consent.', NEW.user_id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_biometric_consent ON public.biometric_readings;
CREATE TRIGGER trg_enforce_biometric_consent
  BEFORE INSERT ON public.biometric_readings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_biometric_consent();

-- Server-side consent granting (called from API, never from client directly)
CREATE OR REPLACE FUNCTION public.grant_biometric_consent(
  p_user_id UUID, p_version TEXT DEFAULT '1.0', p_ip_hash TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET
    biometric_consent_granted_at       = NOW(),
    biometric_consent_version          = p_version,
    data_processing_consent_granted_at = NOW(),
    consent_ip_hash                    = p_ip_hash,
    updated_at                         = NOW()
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_biometric_consent(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET
    biometric_consent_granted_at       = NULL,
    data_processing_consent_granted_at = NULL,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- ── C-4: Full GDPR/CCPA cascading deletion ────────────────────
CREATE OR REPLACE FUNCTION public.delete_user_all_data(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bio_rows  INTEGER;
  v_sess_rows INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_bio_rows  FROM public.biometric_readings WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_sess_rows FROM public.listening_sessions  WHERE user_id = p_user_id;

  DELETE FROM public.biometric_readings      WHERE user_id = p_user_id;
  DELETE FROM public.user_music_preferences  WHERE user_id = p_user_id;
  DELETE FROM public.music_tokens            WHERE user_id = p_user_id;
  DELETE FROM public.push_subscriptions      WHERE user_id = p_user_id;
  DELETE FROM public.user_biometric_baseline WHERE user_id = p_user_id;
  DELETE FROM public.generated_playlists
    WHERE session_id IN (SELECT id FROM public.listening_sessions WHERE user_id = p_user_id);
  DELETE FROM public.session_songs
    WHERE session_id IN (SELECT id FROM public.listening_sessions WHERE user_id = p_user_id);
  DELETE FROM public.listening_sessions WHERE user_id = p_user_id;
  DELETE FROM public.encryption_keys    WHERE user_id = p_user_id;

  -- Anonymize profile (auth.users deleted separately via admin SDK)
  UPDATE public.profiles SET
    display_name                       = 'Deleted User',
    avatar_url                         = NULL,
    age                                = NULL,
    biometric_consent_granted_at       = NULL,
    data_processing_consent_granted_at = NULL,
    healthkit_consent_granted_at       = NULL,
    consent_ip_hash                    = NULL,
    updated_at                         = NOW()
  WHERE id = p_user_id;

  INSERT INTO public.data_retention_log (purge_type, cutoff_date, rows_deleted)
  VALUES ('user_gdpr_delete', NOW(), v_bio_rows + v_sess_rows);

  RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id,
    'deleted_at', NOW(), 'biometric_rows', v_bio_rows, 'session_rows', v_sess_rows);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

-- ── C-5: GDPR Article 20 portable data export ─────────────────
CREATE OR REPLACE FUNCTION public.export_user_data(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile  JSONB; v_sessions JSONB; v_bio JSONB; v_prefs JSONB; v_songs JSONB;
BEGIN
  SELECT row_to_json(p)::JSONB INTO v_profile FROM (
    SELECT id, display_name, age, created_at,
           biometric_consent_granted_at, biometric_consent_version
    FROM public.profiles WHERE id = p_user_id
  ) p;
  SELECT jsonb_agg(row_to_json(s)) INTO v_sessions FROM (
    SELECT id, activity_type, started_at, ended_at, duration_minutes,
           flow_score, avg_heart_rate, avg_hrv
    FROM public.listening_sessions WHERE user_id = p_user_id ORDER BY started_at DESC
  ) s;
  SELECT jsonb_agg(row_to_json(b)) INTO v_bio FROM (
    SELECT recorded_at, heart_rate, hrv_rmssd, blood_oxygen, respiratory_rate,
           stress_level, focus_score, device_type
    FROM public.biometric_readings
    WHERE user_id = p_user_id AND recorded_at > NOW() - INTERVAL '90 days'
    ORDER BY recorded_at DESC LIMIT 100000
  ) b;
  SELECT row_to_json(pref)::JSONB INTO v_prefs FROM (
    SELECT preferred_genres, preferred_tempos, preferred_energy_levels,
           disliked_genres, preferred_activities
    FROM public.user_music_preferences WHERE user_id = p_user_id
  ) pref;
  SELECT jsonb_agg(row_to_json(ss)) INTO v_songs FROM (
    SELECT ss.played_at, ss.skipped, ss.completed, ss.rating, ss.replayed,
           s.title, s.artist, s.bpm
    FROM public.session_songs ss
    JOIN public.songs s ON ss.song_id = s.id
    JOIN public.listening_sessions ls ON ss.session_id = ls.id
    WHERE ls.user_id = p_user_id ORDER BY ss.played_at DESC LIMIT 50000
  ) ss;
  RETURN jsonb_build_object(
    'export_version','1.0','exported_at',NOW(),'user_id',p_user_id,
    'profile',v_profile,
    'sessions',COALESCE(v_sessions,'[]'::JSONB),
    'biometric_sample',COALESCE(v_bio,'[]'::JSONB),
    'music_preferences',COALESCE(v_prefs,'{}'::JSONB),
    'song_play_history',COALESCE(v_songs,'[]'::JSONB)
  );
END;
$$;

-- ── C-7: Retention log + 2-year purge ────────────────────────
CREATE TABLE IF NOT EXISTS public.data_retention_log (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purge_type   TEXT        NOT NULL,
  cutoff_date  TIMESTAMPTZ NOT NULL,
  rows_deleted INTEGER     NOT NULL DEFAULT 0,
  executed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.data_retention_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_retention_log" ON public.data_retention_log USING (FALSE);

CREATE OR REPLACE FUNCTION public.purge_expired_biometric_data()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deleted INTEGER; v_cutoff TIMESTAMPTZ := NOW() - INTERVAL '2 years';
BEGIN
  DELETE FROM public.biometric_readings WHERE recorded_at < v_cutoff;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  INSERT INTO public.data_retention_log (purge_type, cutoff_date, rows_deleted)
  VALUES ('biometric_raw_2yr', v_cutoff, v_deleted);
  RETURN jsonb_build_object('rows_deleted',v_deleted,'cutoff',v_cutoff,'executed_at',NOW());
END;
$$;
-- Schedule via pg_cron after enabling extension:
-- SELECT cron.schedule('flowstate-bio-purge','0 3 * * 0',
--   $$SELECT public.purge_expired_biometric_data()$$);

-- ── Grants ────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.check_biometric_consent(UUID)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_biometric_consent(UUID,TEXT,TEXT)   TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_biometric_consent(UUID)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_user_data(UUID)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_all_data(UUID)                TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_biometric_data()            TO service_role;

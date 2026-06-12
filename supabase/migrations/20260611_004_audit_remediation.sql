-- ============================================================
-- FLOWSTATE MIGRATION 004 — Audit remediation (June 2026)
--
-- C-7  Schema repairs: columns referenced by functions/edge code
--      that never existed (phantom schema)
-- C-2  export_user_data: bind to caller, fix phantom columns
-- C-3  delete_user_all_data: fix phantom columns so deletion
--      actually succeeds; include track_feedback + vault secrets
-- C-1  Consent RPCs: bind p_user_id to auth.uid()
-- SEC  Function ACL hardening: SECURITY DEFINER functions were
--      executable by PUBLIC (incl. get_decrypted_music_token →
--      cross-user DSP token theft). Explicit REVOKE/GRANT below.
-- C-4  Schedule the 2-year biometric retention purge
-- ============================================================

-- ── C-7: schema repairs ───────────────────────────────────────

-- Age powers HRmax estimation (220 - age) and was referenced by
-- delete/export functions without ever being created.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age INTEGER CHECK (age BETWEEN 13 AND 120);

-- Written by session-post-processor; read by export_user_data.
ALTER TABLE public.listening_sessions
  ADD COLUMN IF NOT EXISTS duration_minutes DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS avg_heart_rate   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS avg_hrv          DOUBLE PRECISION;

-- Written by dsp-connector complete_song_play; read by export + reports.
ALTER TABLE public.session_songs
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rating    INTEGER CHECK (rating BETWEEN 1 AND 5);

-- store_user_key_in_vault and delete_user_all_data key off user_id.
ALTER TABLE public.encryption_keys
  ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
-- Vault-referenced rows store no key material locally.
ALTER TABLE public.encryption_keys ALTER COLUMN key_value DROP NOT NULL;

-- ── Vault key storage (fixed: supplies required key_name) ─────
CREATE OR REPLACE FUNCTION public.store_user_key_in_vault(p_user_id UUID, p_key_b64 TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE
  v_name TEXT := 'flowstate_user_key_' || p_user_id::TEXT;
  v_id   UUID;
BEGIN
  SELECT vault.create_secret(p_key_b64, v_name,
    'AES-256 key for FLOWSTATE user ' || p_user_id::TEXT) INTO v_id;
  INSERT INTO public.encryption_keys (user_id, key_name, key_reference, key_provider)
  VALUES (p_user_id, v_name, v_name, 'supabase_vault')
  ON CONFLICT (user_id) DO UPDATE
    SET key_reference = EXCLUDED.key_reference, updated_at = NOW();
  RETURN v_name;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Vault storage failed for user %: %. Enable Supabase Vault extension.', p_user_id, SQLERRM;
  RETURN NULL;
END;
$$;

-- ── C-1: consent RPCs bound to the calling user ───────────────
-- auth.uid() IS NULL for service-role calls (server-side flows);
-- authenticated callers may only act on themselves.
CREATE OR REPLACE FUNCTION public.check_biometric_consent(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ts TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot read another user''s consent status' USING ERRCODE = '42501';
  END IF;
  SELECT biometric_consent_granted_at INTO v_ts FROM public.profiles WHERE id = p_user_id;
  RETURN v_ts IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_biometric_consent(
  p_user_id UUID, p_version TEXT DEFAULT '1.0', p_ip_hash TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot grant consent for another user' USING ERRCODE = '42501';
  END IF;
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
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot revoke consent for another user' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET
    biometric_consent_granted_at       = NULL,
    data_processing_consent_granted_at = NULL,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- ── Personalization RPC bound to the calling user ─────────────
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
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot write another user''s preferences' USING ERRCODE = '42501';
  END IF;
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

-- ── C-2: GDPR Article 20 export — caller-bound, real schema ───
CREATE OR REPLACE FUNCTION public.export_user_data(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile  JSONB; v_sessions JSONB; v_bio JSONB; v_prefs JSONB;
  v_songs    JSONB; v_feedback JSONB;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot export another user''s data' USING ERRCODE = '42501';
  END IF;

  SELECT row_to_json(p)::JSONB INTO v_profile FROM (
    SELECT id, display_name, age, created_at,
           biometric_consent_granted_at, biometric_consent_version
    FROM public.profiles WHERE id = p_user_id
  ) p;

  SELECT jsonb_agg(row_to_json(s)) INTO v_sessions FROM (
    SELECT ls.id, at.name AS activity_type, ls.started_at, ls.ended_at,
           ls.duration_minutes, ls.flow_score, ls.avg_heart_rate, ls.avg_hrv,
           ls.time_in_flow_minutes, ls.mood_before, ls.mood_after
    FROM public.listening_sessions ls
    LEFT JOIN public.activity_types at ON at.id = ls.activity_type_id
    WHERE ls.user_id = p_user_id ORDER BY ls.started_at DESC
  ) s;

  SELECT jsonb_agg(row_to_json(b)) INTO v_bio FROM (
    SELECT recorded_at, heart_rate, hrv_rmssd, blood_oxygen, respiratory_rate,
           stress_level, focus_score, device_type
    FROM public.biometric_readings
    WHERE user_id = p_user_id AND recorded_at > NOW() - INTERVAL '90 days'
    ORDER BY recorded_at DESC LIMIT 100000
  ) b;

  SELECT jsonb_agg(row_to_json(pref)) INTO v_prefs FROM (
    SELECT activity_type, preferred_tempo_avg, preferred_energy_avg,
           skip_rate, like_count, skip_count, session_count
    FROM public.user_music_preferences WHERE user_id = p_user_id
  ) pref;

  SELECT jsonb_agg(row_to_json(ss)) INTO v_songs FROM (
    SELECT ss.played_at, ss.skipped, ss.completed, ss.rating, ss.replayed,
           s.title, s.artist, s.tempo
    FROM public.session_songs ss
    JOIN public.songs s ON ss.song_id = s.id
    JOIN public.listening_sessions ls ON ss.session_id = ls.id
    WHERE ls.user_id = p_user_id ORDER BY ss.played_at DESC LIMIT 50000
  ) ss;

  SELECT jsonb_agg(row_to_json(tf)) INTO v_feedback FROM (
    SELECT track_title, track_artist, feedback, activity_type, created_at
    FROM public.track_feedback WHERE user_id = p_user_id
  ) tf;

  RETURN jsonb_build_object(
    'export_version','1.1','exported_at',NOW(),'user_id',p_user_id,
    'profile',v_profile,
    'sessions',COALESCE(v_sessions,'[]'::JSONB),
    'biometric_sample',COALESCE(v_bio,'[]'::JSONB),
    'music_preferences',COALESCE(v_prefs,'[]'::JSONB),
    'song_play_history',COALESCE(v_songs,'[]'::JSONB),
    'track_feedback',COALESCE(v_feedback,'[]'::JSONB)
  );
END;
$$;

-- ── C-3: GDPR Article 17 deletion — real schema, full coverage ─
CREATE OR REPLACE FUNCTION public.delete_user_all_data(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bio_rows  INTEGER;
  v_sess_rows INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot delete another user''s data' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_bio_rows  FROM public.biometric_readings WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_sess_rows FROM public.listening_sessions  WHERE user_id = p_user_id;

  DELETE FROM public.biometric_readings      WHERE user_id = p_user_id;
  DELETE FROM public.track_feedback          WHERE user_id = p_user_id;
  DELETE FROM public.user_music_preferences  WHERE user_id = p_user_id;
  DELETE FROM public.music_tokens            WHERE user_id = p_user_id;
  DELETE FROM public.push_subscriptions      WHERE user_id = p_user_id;
  DELETE FROM public.user_biometric_baseline WHERE user_id = p_user_id;
  DELETE FROM public.generated_playlists     WHERE user_id = p_user_id;
  DELETE FROM public.session_songs
    WHERE session_id IN (SELECT id FROM public.listening_sessions WHERE user_id = p_user_id);
  DELETE FROM public.listening_sessions WHERE user_id = p_user_id;
  DELETE FROM public.encryption_keys    WHERE user_id = p_user_id;

  -- Best-effort vault secret cleanup (vault may not be enabled)
  BEGIN
    DELETE FROM vault.secrets WHERE name = 'flowstate_user_key_' || p_user_id::TEXT;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Anonymize profile (auth.users deleted separately via admin SDK)
  UPDATE public.profiles SET
    display_name                       = 'Deleted User',
    email                              = NULL,
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

-- ── SEC: function ACL hardening ───────────────────────────────
-- Postgres grants EXECUTE to PUBLIC on new functions by default, which
-- exposed every SECURITY DEFINER helper to any authenticated (or anon)
-- caller via PostgREST. Lock down explicitly.

-- Token/credential decryption: service-role ONLY (was a cross-user
-- DSP-token theft vector).
REVOKE EXECUTE ON FUNCTION public.get_decrypted_music_token(uuid)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_decrypted_push_subscriptions(uuid)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.encrypt_sensitive(text)                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_sensitive(text)                     FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_decrypted_music_token(uuid)             TO service_role;
GRANT  EXECUTE ON FUNCTION public.get_decrypted_push_subscriptions(uuid)      TO service_role;
GRANT  EXECUTE ON FUNCTION public.encrypt_sensitive(text)                     TO service_role;
GRANT  EXECUTE ON FUNCTION public.decrypt_sensitive(text)                     TO service_role;

-- Compliance functions: self-service ones stay available to authenticated
-- (they are auth.uid()-bound above); destructive/global ones are
-- service-role only.
REVOKE EXECUTE ON FUNCTION public.check_biometric_consent(UUID)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.grant_biometric_consent(UUID, TEXT, TEXT)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_biometric_consent(UUID)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.export_user_data(UUID)                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_all_data(UUID)                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_expired_biometric_data()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_orphan_sessions()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.store_user_key_in_vault(UUID, TEXT)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_music_preference(UUID, TEXT, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.check_biometric_consent(UUID)                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_biometric_consent(UUID, TEXT, TEXT)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_biometric_consent(UUID)               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.export_user_data(UUID)                       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_all_data(UUID)                   TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_biometric_data()               TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_orphan_sessions()                    TO service_role;
GRANT EXECUTE ON FUNCTION public.store_user_key_in_vault(UUID, TEXT)          TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_music_preference(UUID, TEXT, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;

-- ── C-4: schedule the 2-year retention purge ──────────────────
-- Raw biometric rows older than 2 years are deleted weekly; session-level
-- aggregates (listening_sessions.avg_*, flow_score, post_session_report)
-- are retained, satisfying the aggregate-after-2-years policy.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'flowstate-bio-purge',
      '0 3 * * 0',
      $job$SELECT public.purge_expired_biometric_data()$job$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed — schedule flowstate-bio-purge manually';
  END IF;
END;
$do$;

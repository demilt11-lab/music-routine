-- GDPR Export: include all biometric columns including EEG bands
-- Previous version of export_user_data omitted eeg_* columns added in schema_expansion.
-- GDPR Article 20 requires a complete portable copy of ALL personal data held.

CREATE OR REPLACE FUNCTION public.export_user_data(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile  JSONB;
  v_sessions JSONB;
  v_bio      JSONB;
  v_prefs    JSONB;
  v_songs    JSONB;
BEGIN
  IF current_setting('role') <> 'service_role' AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Access denied: you may only export your own data'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT row_to_json(p)::JSONB INTO v_profile FROM (
    SELECT id, display_name, age, created_at,
           biometric_consent_granted_at, biometric_consent_version,
           healthkit_consent_granted_at
    FROM public.profiles WHERE id = p_user_id
  ) p;

  SELECT jsonb_agg(row_to_json(s)) INTO v_sessions FROM (
    SELECT id, activity_type, started_at, ended_at, duration_minutes,
           flow_score, avg_heart_rate, avg_hrv
    FROM public.listening_sessions
    WHERE user_id = p_user_id
    ORDER BY started_at DESC
  ) s;

  -- Full biometric history including EEG bands (GDPR Article 20 completeness)
  SELECT jsonb_agg(row_to_json(b)) INTO v_bio FROM (
    SELECT recorded_at, heart_rate, hrv_rmssd, blood_oxygen, respiratory_rate,
           stress_level, focus_score, relaxation_score,
           eeg_alpha_rel, eeg_beta_rel, eeg_theta_rel, eeg_gamma_rel, eeg_delta_rel,
           device_type, confidence, signal_quality, activity_type
    FROM public.biometric_readings
    WHERE user_id = p_user_id
    ORDER BY recorded_at DESC
    LIMIT 1000000
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
    'export_version', '3',
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

GRANT EXECUTE ON FUNCTION public.export_user_data(UUID) TO authenticated;

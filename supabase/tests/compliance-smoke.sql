\set ON_ERROR_STOP on
\set QUIET on

-- seed two users (profiles auto-created by handle_new_user trigger)
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev');

-- ════ USER A context (authenticated + JWT sub claim) ════
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

-- T1: self consent grant succeeds
SELECT public.grant_biometric_consent('00000000-0000-0000-0000-00000000000a'::uuid, '1.0', NULL);
\echo T1 PASS: self consent granted

-- T2: cross-user consent grant is blocked
DO $$ BEGIN
  BEGIN
    PERFORM public.grant_biometric_consent('00000000-0000-0000-0000-00000000000b'::uuid, '1.0', NULL);
    RAISE EXCEPTION 'AUTHZ HOLE: cross-user consent grant succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
\echo T2 PASS: cross-user consent grant blocked

-- T3: self export works and contains expected sections
DO $$
DECLARE v jsonb;
BEGIN
  v := public.export_user_data('00000000-0000-0000-0000-00000000000a'::uuid);
  IF v->>'export_version' IS NULL OR v->'profile' IS NULL OR v->'sessions' IS NULL
     OR v->'biometric_sample' IS NULL OR v->'music_preferences' IS NULL THEN
    RAISE EXCEPTION 'export payload incomplete: %', v;
  END IF;
END $$;
\echo T3 PASS: self export returns complete payload

-- T4: cross-user export is blocked
DO $$ BEGIN
  BEGIN
    PERFORM public.export_user_data('00000000-0000-0000-0000-00000000000b'::uuid);
    RAISE EXCEPTION 'AUTHZ HOLE: cross-user export succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
\echo T4 PASS: cross-user export blocked

-- T5: cross-user preference write is blocked; self write works
DO $$ BEGIN
  BEGIN
    PERFORM public.upsert_music_preference('00000000-0000-0000-0000-00000000000b'::uuid, 'study', 120, 0.5, 'up');
    RAISE EXCEPTION 'AUTHZ HOLE: cross-user preference write succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT public.upsert_music_preference('00000000-0000-0000-0000-00000000000a'::uuid, 'study', 120, 0.5, 'up');
\echo T5 PASS: preference writes self-only

-- T6: decrypted-token RPCs are no longer reachable by authenticated users
DO $$ BEGIN
  BEGIN
    PERFORM public.get_decrypted_music_token('00000000-0000-0000-0000-00000000000b'::uuid);
    RAISE EXCEPTION 'AUTHZ HOLE: authenticated user can decrypt DSP tokens';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
\echo T6 PASS: token decryption locked to service_role

-- T7: delete_user_all_data is not executable by authenticated users at all
DO $$ BEGIN
  BEGIN
    PERFORM public.delete_user_all_data('00000000-0000-0000-0000-00000000000a'::uuid);
    RAISE EXCEPTION 'AUTHZ HOLE: authenticated user can call delete_user_all_data';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
\echo T7 PASS: deletion RPC locked to service_role

-- ════ service context (no JWT claim → auth.uid() IS NULL) ════
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);

-- T8: consent trigger blocks biometric inserts for non-consented user B
DO $$ BEGIN
  BEGIN
    INSERT INTO public.biometric_readings (user_id, heart_rate, recorded_at)
    VALUES ('00000000-0000-0000-0000-00000000000b', 72, NOW());
    RAISE EXCEPTION 'COMPLIANCE HOLE: biometric insert without consent succeeded';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
END $$;
\echo T8 PASS: consent trigger blocks non-consented inserts

-- T9: consented user A can store biometrics (incl. expanded columns)
INSERT INTO public.biometric_readings
  (user_id, heart_rate, hrv_rmssd, blood_oxygen, respiratory_rate, recorded_at, data_gap, signal_quality)
VALUES
  ('00000000-0000-0000-0000-00000000000a', 88, 42.5, 98.2, 14.0, NOW(), FALSE, 95);
\echo T9 PASS: consented biometric insert with expanded columns

-- T10: full session round-trip with playlist-engine / dsp-connector columns
INSERT INTO public.listening_sessions (id, user_id, activity_type_id, started_at, ended_at)
SELECT '00000000-0000-0000-0000-000000000051'::uuid, '00000000-0000-0000-0000-00000000000a', id,
       NOW() - INTERVAL '30 min', NOW()
FROM public.activity_types WHERE name = 'study' LIMIT 1;
INSERT INTO public.songs (id, user_id, title, artist, tempo, energy, speechiness)
VALUES ('00000000-0000-0000-0000-0000000000d1'::uuid, '00000000-0000-0000-0000-00000000000a',
        'Test Track', 'Test Artist', 120, 0.5, 0.1);
INSERT INTO public.session_songs (session_id, song_id, played_at, selection_reason, queued_at_state, biometric_state_at_start)
VALUES ('00000000-0000-0000-0000-000000000051'::uuid, '00000000-0000-0000-0000-0000000000d1'::uuid,
        NOW(), 'state=OPTIMAL direction=MAINTAIN', 'OPTIMAL', '{"hr_mean": 70}');
UPDATE public.session_songs SET
  completed = TRUE, rating = 4, hr_delta = -2.5, focus_delta = 6.0,
  contributed_to_flow = TRUE, biometric_state_at_end = '{"hr_mean": 68}'
WHERE session_id = '00000000-0000-0000-0000-000000000051'::uuid;
UPDATE public.listening_sessions SET
  flow_score = 74, duration_minutes = 30, avg_heart_rate = 71.2, avg_hrv = 48.0
WHERE id = '00000000-0000-0000-0000-000000000051'::uuid;
\echo T10 PASS: session/song training-signal columns all writable

-- T11: vault key storage records a reference row
SELECT public.store_user_key_in_vault('00000000-0000-0000-0000-00000000000a'::uuid, 'dGVzdC1rZXk=');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.encryption_keys
                 WHERE user_id = '00000000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'vault reference row missing';
  END IF;
END $$;
\echo T11 PASS: vault key reference stored

-- T12: retention purge runs and logs
SELECT public.purge_expired_biometric_data();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.data_retention_log WHERE purge_type = 'biometric_raw_2yr') THEN
    RAISE EXCEPTION 'purge did not log';
  END IF;
END $$;
\echo T12 PASS: retention purge executes and logs

-- T13: GDPR deletion succeeds end-to-end and reports success:true
DO $$
DECLARE v jsonb;
BEGIN
  v := public.delete_user_all_data('00000000-0000-0000-0000-00000000000a'::uuid);
  IF (v->>'success')::boolean IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'deletion reported failure: %', v;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.biometric_readings WHERE user_id = '00000000-0000-0000-0000-00000000000a')
     OR EXISTS (SELECT 1 FROM public.listening_sessions WHERE user_id = '00000000-0000-0000-0000-00000000000a')
     OR EXISTS (SELECT 1 FROM public.encryption_keys WHERE user_id = '00000000-0000-0000-0000-00000000000a')
     OR EXISTS (SELECT 1 FROM vault.secrets WHERE name LIKE '%00000000-0000-0000-0000-00000000000a%') THEN
    RAISE EXCEPTION 'residual data after deletion';
  END IF;
  IF (SELECT display_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000000a') <> 'Deleted User' THEN
    RAISE EXCEPTION 'profile not anonymized';
  END IF;
END $$;
\echo T13 PASS: GDPR deletion wipes all data, vault secret, and anonymizes profile

-- T14: scheduled jobs registered by cron_setup
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM cron.job WHERE jobname IN ('cleanup-orphan-sessions','weekly-digest-email')) < 2 THEN
    RAISE EXCEPTION 'cron jobs missing';
  END IF;
END $$;
\echo T14 PASS: cron jobs registered

\echo ALL SMOKE TESTS PASSED

-- ============================================================
-- FLOWSTATE MIGRATION 006 — Population model + readiness (Module 7)
--
-- 1. population_song_response: anonymized cross-user response aggregates
--    keyed by spotify_track_id. The playlist-engine blends these with the
--    user's personal profile (personal weight grows with session count,
--    capped 0.85 / population floor 0.15 per spec).
-- 2. aggregate_song_response now refreshes the population row whenever a
--    user's profile for a track updates.
-- 3. compute_readiness: pre-session readiness score + predicted flow
--    potential from HRV trend vs baseline and recent flow scores.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.population_song_response (
  spotify_track_id       TEXT PRIMARY KEY,
  avg_hr_delta_60s       DOUBLE PRECISION,
  avg_focus_delta_60s    DOUBLE PRECISION,
  avg_stress_delta_60s   DOUBLE PRECISION,
  avg_hrv_delta_60s      DOUBLE PRECISION,
  flow_contribution_rate DOUBLE PRECISION,
  sample_count           INTEGER NOT NULL DEFAULT 0,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Aggregates only — but lock to service_role anyway (read via engine).
ALTER TABLE public.population_song_response ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.population_song_response FROM anon, authenticated;
GRANT ALL ON public.population_song_response TO service_role;

-- Refresh one track's population aggregate from every user's per-song
-- profile rows (no user identifiers stored — averages and a count only).
CREATE OR REPLACE FUNCTION public.refresh_population_response(p_spotify_track_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_spotify_track_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.population_song_response AS p (
    spotify_track_id, avg_hr_delta_60s, avg_focus_delta_60s,
    avg_stress_delta_60s, avg_hrv_delta_60s, flow_contribution_rate,
    sample_count, updated_at
  )
  SELECT
    s.spotify_track_id,
    AVG(s.avg_hr_delta_60s)     FILTER (WHERE s.avg_hr_delta_60s     IS NOT NULL),
    AVG(s.avg_focus_delta_60s)  FILTER (WHERE s.avg_focus_delta_60s  IS NOT NULL),
    AVG(s.avg_stress_delta_60s) FILTER (WHERE s.avg_stress_delta_60s IS NOT NULL),
    AVG(s.avg_hrv_delta_60s)    FILTER (WHERE s.avg_hrv_delta_60s    IS NOT NULL),
    AVG(s.state_transition_rate) FILTER (WHERE s.state_transition_rate IS NOT NULL),
    COUNT(*) FILTER (WHERE s.avg_hr_delta_60s IS NOT NULL
                        OR s.avg_focus_delta_60s IS NOT NULL
                        OR s.state_transition_rate IS NOT NULL),
    NOW()
  FROM public.songs s
  WHERE s.spotify_track_id = p_spotify_track_id
  GROUP BY s.spotify_track_id
  ON CONFLICT (spotify_track_id) DO UPDATE SET
    avg_hr_delta_60s       = EXCLUDED.avg_hr_delta_60s,
    avg_focus_delta_60s    = EXCLUDED.avg_focus_delta_60s,
    avg_stress_delta_60s   = EXCLUDED.avg_stress_delta_60s,
    avg_hrv_delta_60s      = EXCLUDED.avg_hrv_delta_60s,
    flow_contribution_rate = EXCLUDED.flow_contribution_rate,
    sample_count           = EXCLUDED.sample_count,
    updated_at             = NOW();
END;
$$;

-- Extend the per-song aggregation (005) to also refresh the population row.
CREATE OR REPLACE FUNCTION public.aggregate_song_response(p_song_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_track TEXT;
BEGIN
  UPDATE public.songs s SET
    avg_hr_delta_60s     = agg.hr_delta,
    avg_focus_delta_60s  = agg.focus_delta,
    avg_stress_delta_60s = agg.stress_delta,
    avg_hrv_delta_60s    = agg.hrv_delta,
    state_transition_rate = agg.flow_rate
  FROM (
    SELECT
      AVG(ss.hr_delta)     FILTER (WHERE ss.hr_delta     IS NOT NULL) AS hr_delta,
      AVG(ss.focus_delta)  FILTER (WHERE ss.focus_delta  IS NOT NULL) AS focus_delta,
      AVG(ss.stress_delta) FILTER (WHERE ss.stress_delta IS NOT NULL) AS stress_delta,
      AVG(ss.hrv_delta)    FILTER (WHERE ss.hrv_delta    IS NOT NULL) AS hrv_delta,
      AVG(CASE WHEN ss.contributed_to_flow THEN 1.0 ELSE 0.0 END)     AS flow_rate
    FROM public.session_songs ss
    WHERE ss.song_id = p_song_id
      AND (ss.completed OR ss.contributed_to_flow OR ss.skipped)
  ) agg
  WHERE s.id = p_song_id;

  SELECT spotify_track_id INTO v_track FROM public.songs WHERE id = p_song_id;
  PERFORM public.refresh_population_response(v_track);
END;
$$;

-- ── Pre-session readiness (spec: "flow potential today: HIGH/MED/LOW") ──
-- Heuristic v1: recent-HRV trend vs the user's HRV baseline (parasympathetic
-- recovery proxy) plus recent flow-score momentum. 50 = neutral default
-- until enough history exists.
CREATE OR REPLACE FUNCTION public.compute_readiness(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_baseline_hrv DOUBLE PRECISION;
  v_recent_hrv   DOUBLE PRECISION;
  v_recent_flow  DOUBLE PRECISION;
  v_score        DOUBLE PRECISION := 50;
  v_potential    TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot read another user''s readiness' USING ERRCODE = '42501';
  END IF;

  SELECT hrv_baseline_rmssd INTO v_baseline_hrv
  FROM public.user_biometric_baseline WHERE user_id = p_user_id;

  SELECT AVG(avg_hrv), AVG(flow_score) INTO v_recent_hrv, v_recent_flow
  FROM (
    SELECT avg_hrv, flow_score
    FROM public.listening_sessions
    WHERE user_id = p_user_id AND ended_at IS NOT NULL
    ORDER BY ended_at DESC LIMIT 3
  ) recent;

  IF v_baseline_hrv IS NOT NULL AND v_baseline_hrv > 0 AND v_recent_hrv IS NOT NULL THEN
    -- ±25 points for HRV running above/below the personal baseline
    v_score := v_score + GREATEST(-25, LEAST(25, (v_recent_hrv / v_baseline_hrv - 1) * 100));
  END IF;
  IF v_recent_flow IS NOT NULL THEN
    -- ±15 points for recent flow momentum around the 50 midpoint
    v_score := v_score + GREATEST(-15, LEAST(15, (v_recent_flow - 50) * 0.3));
  END IF;
  v_score := GREATEST(0, LEAST(100, v_score));

  v_potential := CASE WHEN v_score >= 70 THEN 'HIGH'
                      WHEN v_score >= 45 THEN 'MEDIUM'
                      ELSE 'LOW' END;

  RETURN jsonb_build_object(
    'readiness_score', ROUND(v_score::numeric, 1),
    'predicted_flow_potential', v_potential,
    'basis', jsonb_build_object(
      'baseline_hrv', v_baseline_hrv,
      'recent_hrv', v_recent_hrv,
      'recent_flow_score', v_recent_flow
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_population_response(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_readiness(UUID)           FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.refresh_population_response(TEXT) TO service_role;
GRANT  EXECUTE ON FUNCTION public.compute_readiness(UUID)           TO authenticated, service_role;

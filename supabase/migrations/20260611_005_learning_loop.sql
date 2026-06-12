-- ============================================================
-- FLOWSTATE MIGRATION 005 — Learning loop (Module 7)
--
-- H-4  Close the song-response learning loop: roll the per-play training
--      signals captured in session_songs (hr_delta, focus_delta, skip,
--      contributed_to_flow) up into each song's physiological response
--      profile (songs.avg_*_delta_60s, state_transition_rate). The
--      playlist-engine reads these columns to rank candidates, so without
--      this aggregation step the personalization never improves.
-- ============================================================

-- Recompute one song's response profile from all of a user's completed
-- plays of it. Population-level means; weighting a personal model on top is
-- a later step, but this is the signal everything else builds on.
CREATE OR REPLACE FUNCTION public.aggregate_song_response(p_song_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.songs s SET
    avg_hr_delta_60s     = agg.hr_delta,
    avg_focus_delta_60s  = agg.focus_delta,
    avg_stress_delta_60s = agg.stress_delta,
    avg_hrv_delta_60s    = agg.hrv_delta,
    -- fraction of plays that the session classifier credited with flow
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
END;
$$;

-- After a session ends, refresh response profiles for exactly the songs it
-- touched, and fold a skip into the user's per-activity preference model so
-- negative signals propagate (positive ones already flow via track feedback).
CREATE OR REPLACE FUNCTION public.aggregate_session_learning(p_session_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_song   RECORD;
  v_count  INTEGER := 0;
  v_user   UUID;
  v_activity TEXT;
BEGIN
  SELECT ls.user_id, at.name INTO v_user, v_activity
  FROM public.listening_sessions ls
  LEFT JOIN public.activity_types at ON at.id = ls.activity_type_id
  WHERE ls.id = p_session_id;

  FOR v_song IN
    SELECT ss.song_id, bool_or(ss.skipped) AS any_skip,
           AVG(s.tempo) AS tempo, AVG(s.energy) AS energy
    FROM public.session_songs ss
    JOIN public.songs s ON s.id = ss.song_id
    WHERE ss.session_id = p_session_id
    GROUP BY ss.song_id
  LOOP
    PERFORM public.aggregate_song_response(v_song.song_id);
    v_count := v_count + 1;

    IF v_user IS NOT NULL AND v_activity IS NOT NULL AND v_song.any_skip THEN
      PERFORM public.upsert_music_preference(
        v_user, v_activity, v_song.tempo, v_song.energy, 'down'
      );
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.aggregate_song_response(UUID)     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.aggregate_session_learning(UUID)  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.aggregate_song_response(UUID)     TO service_role;
GRANT  EXECUTE ON FUNCTION public.aggregate_session_learning(UUID)  TO service_role;

-- ============================================================
-- FLOWSTATE MIGRATION 002
-- M-4  biometric_readings full spec columns
-- M-5  listening_sessions flow scoring
-- M-3  songs missing audio features + physio response profile
-- H-4  user_biometric_baseline table
-- H-12 session_songs training signal columns
-- ============================================================

-- ── biometric_readings: full spec schema ─────────────────────
ALTER TABLE public.biometric_readings
  ADD COLUMN IF NOT EXISTS hrv_rmssd                DOUBLE PRECISION,  -- ms
  ADD COLUMN IF NOT EXISTS hrv_sdnn                 DOUBLE PRECISION,  -- ms
  ADD COLUMN IF NOT EXISTS blood_oxygen             DOUBLE PRECISION,  -- SpO2 %
  ADD COLUMN IF NOT EXISTS respiratory_rate         DOUBLE PRECISION,  -- breaths/min
  ADD COLUMN IF NOT EXISTS blood_pressure_systolic  INTEGER,
  ADD COLUMN IF NOT EXISTS blood_pressure_diastolic INTEGER,
  ADD COLUMN IF NOT EXISTS skin_temperature_delta   DOUBLE PRECISION,  -- °C delta
  ADD COLUMN IF NOT EXISTS eda_score                DOUBLE PRECISION,  -- 0-100
  ADD COLUMN IF NOT EXISTS eeg_focus_score          DOUBLE PRECISION,  -- 0-100
  ADD COLUMN IF NOT EXISTS eeg_calm_score           DOUBLE PRECISION,  -- 0-100
  ADD COLUMN IF NOT EXISTS activity_intensity       DOUBLE PRECISION,  -- 0-10
  ADD COLUMN IF NOT EXISTS steps_per_minute         INTEGER,
  ADD COLUMN IF NOT EXISTS movement_type            TEXT,
  ADD COLUMN IF NOT EXISTS current_track_id         TEXT,
  ADD COLUMN IF NOT EXISTS current_track_bpm        INTEGER,
  ADD COLUMN IF NOT EXISTS current_track_energy     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS current_track_elapsed_s  INTEGER,
  ADD COLUMN IF NOT EXISTS signal_quality           TEXT DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS data_gap                 BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_biometric_brin_time
  ON public.biometric_readings USING BRIN (recorded_at);
CREATE INDEX IF NOT EXISTS idx_biometric_session_time
  ON public.biometric_readings (session_id, recorded_at DESC);

-- ── listening_sessions: flow scoring + session metadata ───────
ALTER TABLE public.listening_sessions
  ADD COLUMN IF NOT EXISTS flow_score                  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS peak_flow_duration_minutes  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS flow_entry_time             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS time_in_flow_minutes        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS biometric_device_id         TEXT,
  ADD COLUMN IF NOT EXISTS dsp_provider                TEXT DEFAULT 'spotify',
  ADD COLUMN IF NOT EXISTS state_log                   JSONB,
  ADD COLUMN IF NOT EXISTS trigger_log                 JSONB,
  ADD COLUMN IF NOT EXISTS flow_events                 JSONB,
  ADD COLUMN IF NOT EXISTS post_session_report         JSONB,
  ADD COLUMN IF NOT EXISTS readiness_score             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS predicted_flow_potential    TEXT;

-- ── songs: missing audio features + physio response ──────────
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS speechiness           DOUBLE PRECISION,  -- 0-1 CRITICAL filter
  ADD COLUMN IF NOT EXISTS instrumentalness      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS acousticness          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS liveness              DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS loudness              DOUBLE PRECISION,  -- dB
  ADD COLUMN IF NOT EXISTS song_key              INTEGER,           -- Pitch class 0-11
  ADD COLUMN IF NOT EXISTS song_mode             INTEGER,           -- 0=minor 1=major
  ADD COLUMN IF NOT EXISTS spectral_centroid     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS danceability          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS valence               DOUBLE PRECISION,  -- musical positivity
  ADD COLUMN IF NOT EXISTS spotify_track_id      TEXT,
  ADD COLUMN IF NOT EXISTS avg_hr_delta_60s      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS avg_hrv_delta_60s     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS avg_focus_delta_60s   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS avg_stress_delta_60s  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS state_transition_rate DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_songs_speechiness ON public.songs (speechiness);
CREATE INDEX IF NOT EXISTS idx_songs_energy_bpm  ON public.songs (energy_level, bpm);
CREATE INDEX IF NOT EXISTS idx_songs_spotify_id  ON public.songs (spotify_track_id);

-- ── user_biometric_baseline (H-4) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_biometric_baseline (
  id                 UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID NOT NULL UNIQUE,
  resting_hr         DOUBLE PRECISION,
  hrmax_estimate     DOUBLE PRECISION,
  hrv_baseline_rmssd DOUBLE PRECISION,
  hrv_baseline_sdnn  DOUBLE PRECISION,
  eeg_baseline_alpha DOUBLE PRECISION,
  eeg_baseline_beta  DOUBLE PRECISION,
  eeg_baseline_theta DOUBLE PRECISION,
  eeg_baseline_delta DOUBLE PRECISION,
  eeg_baseline_gamma DOUBLE PRECISION,
  stress_baseline    DOUBLE PRECISION,
  established_at     TIMESTAMPTZ,
  session_count      INTEGER DEFAULT 0,
  last_updated_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_biometric_baseline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own baseline" ON public.user_biometric_baseline
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── session_songs: training signal columns (H-12) ────────────
ALTER TABLE public.session_songs
  ADD COLUMN IF NOT EXISTS biometric_state_at_start JSONB,
  ADD COLUMN IF NOT EXISTS biometric_state_at_end   JSONB,
  ADD COLUMN IF NOT EXISTS hr_delta                 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS hrv_delta                DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS focus_delta              DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS stress_delta             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS selection_reason         TEXT,
  ADD COLUMN IF NOT EXISTS queued_at_state          TEXT,
  ADD COLUMN IF NOT EXISTS contributed_to_flow      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS replayed                 BOOLEAN DEFAULT FALSE;

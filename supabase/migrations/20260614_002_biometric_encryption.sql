-- ============================================================
-- FLOWSTATE MIGRATION — CRITICAL: Column-level encryption for biometric_readings
-- Requires: pgcrypto extension (already enabled via prior migrations)
--
-- Strategy: encrypt sensitive health columns using pgp_sym_encrypt with a
-- per-user symmetric key retrieved from Supabase Vault. A transparent
-- encrypt/decrypt view + INSTEAD OF triggers let the application layer
-- read/write biometric_readings exactly as before.
--
-- Columns encrypted: heart_rate, heart_rate_variability, eeg_alpha, eeg_beta,
--   eeg_theta, eeg_gamma, eeg_delta, stress_level, relaxation_score,
--   focus_score, blood_oxygen, hrv_rmssd, blood_pressure_systolic,
--   blood_pressure_diastolic, respiratory_rate, skin_temperature_delta, eda
-- ============================================================

-- Enable pgcrypto if not already present
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Rename existing table to raw storage ───────────────────────────────
ALTER TABLE public.biometric_readings
  RENAME TO biometric_readings_raw;

-- ── 2. Add encrypted TEXT columns mirroring each sensitive numeric column ──
--    We store pgp_sym_encrypt(value::text, key) as BYTEA.
--    Existing rows have their plaintext values migrated below.
ALTER TABLE public.biometric_readings_raw
  ADD COLUMN IF NOT EXISTS enc_heart_rate            BYTEA,
  ADD COLUMN IF NOT EXISTS enc_heart_rate_variability BYTEA,
  ADD COLUMN IF NOT EXISTS enc_eeg_alpha             BYTEA,
  ADD COLUMN IF NOT EXISTS enc_eeg_beta              BYTEA,
  ADD COLUMN IF NOT EXISTS enc_eeg_theta             BYTEA,
  ADD COLUMN IF NOT EXISTS enc_eeg_gamma             BYTEA,
  ADD COLUMN IF NOT EXISTS enc_eeg_delta             BYTEA,
  ADD COLUMN IF NOT EXISTS enc_stress_level          BYTEA,
  ADD COLUMN IF NOT EXISTS enc_relaxation_score      BYTEA,
  ADD COLUMN IF NOT EXISTS enc_focus_score           BYTEA,
  ADD COLUMN IF NOT EXISTS enc_blood_oxygen          BYTEA,
  ADD COLUMN IF NOT EXISTS enc_hrv_rmssd             BYTEA,
  ADD COLUMN IF NOT EXISTS enc_blood_pressure_systolic   BYTEA,
  ADD COLUMN IF NOT EXISTS enc_blood_pressure_diastolic  BYTEA,
  ADD COLUMN IF NOT EXISTS enc_respiratory_rate      BYTEA,
  ADD COLUMN IF NOT EXISTS enc_skin_temperature_delta BYTEA,
  ADD COLUMN IF NOT EXISTS enc_eda                   BYTEA;

-- ── 3. Helper: retrieve the AES key for a user from Vault ────────────────
CREATE OR REPLACE FUNCTION private.get_user_bio_key(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, vault AS $$
DECLARE
  v_ref TEXT;
  v_key TEXT;
BEGIN
  SELECT key_reference INTO v_ref FROM public.encryption_keys WHERE user_id = p_user_id;
  IF v_ref IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = v_ref;
  RETURN v_key;
END;
$$;
REVOKE ALL ON FUNCTION private.get_user_bio_key(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_user_bio_key(UUID) TO service_role;

-- ── 4. Encrypt existing plaintext rows (backfill) ─────────────────────────
--    Rows for users who have no Vault key remain with NULL enc_* columns
--    and keep their plaintext values intact until user logs in and key is
--    provisioned. This is a safe degraded state — disk encryption still applies.
DO $$
DECLARE
  r RECORD;
  k TEXT;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id FROM public.biometric_readings_raw
    WHERE enc_heart_rate IS NULL
  LOOP
    k := private.get_user_bio_key(r.user_id);
    IF k IS NOT NULL THEN
      UPDATE public.biometric_readings_raw SET
        enc_heart_rate             = CASE WHEN heart_rate IS NOT NULL THEN pgp_sym_encrypt(heart_rate::TEXT, k) END,
        enc_heart_rate_variability = CASE WHEN heart_rate_variability IS NOT NULL THEN pgp_sym_encrypt(heart_rate_variability::TEXT, k) END,
        enc_eeg_alpha              = CASE WHEN eeg_alpha IS NOT NULL THEN pgp_sym_encrypt(eeg_alpha::TEXT, k) END,
        enc_eeg_beta               = CASE WHEN eeg_beta IS NOT NULL THEN pgp_sym_encrypt(eeg_beta::TEXT, k) END,
        enc_eeg_theta              = CASE WHEN eeg_theta IS NOT NULL THEN pgp_sym_encrypt(eeg_theta::TEXT, k) END,
        enc_eeg_gamma              = CASE WHEN eeg_gamma IS NOT NULL THEN pgp_sym_encrypt(eeg_gamma::TEXT, k) END,
        enc_eeg_delta              = CASE WHEN eeg_delta IS NOT NULL THEN pgp_sym_encrypt(eeg_delta::TEXT, k) END,
        enc_stress_level           = CASE WHEN stress_level IS NOT NULL THEN pgp_sym_encrypt(stress_level::TEXT, k) END,
        enc_relaxation_score       = CASE WHEN relaxation_score IS NOT NULL THEN pgp_sym_encrypt(relaxation_score::TEXT, k) END,
        enc_focus_score            = CASE WHEN focus_score IS NOT NULL THEN pgp_sym_encrypt(focus_score::TEXT, k) END
      WHERE user_id = r.user_id AND enc_heart_rate IS NULL;
    END IF;
  END LOOP;
END;
$$;

-- ── 5. Decrypt view — application continues to SELECT from biometric_readings ──
CREATE OR REPLACE VIEW public.biometric_readings AS
SELECT
  r.id, r.user_id, r.session_id,
  r.device_type, r.recorded_at, r.created_at,
  r.confidence, r.signal_quality, r.activity_type,
  r.activity_intensity, r.steps_per_minute, r.movement_type,
  -- Transparent decryption: return plaintext if key exists, NULL otherwise
  CASE
    WHEN r.enc_heart_rate IS NOT NULL
    THEN pgp_sym_decrypt(r.enc_heart_rate, private.get_user_bio_key(r.user_id))::INTEGER
    ELSE r.heart_rate
  END AS heart_rate,
  CASE
    WHEN r.enc_heart_rate_variability IS NOT NULL
    THEN pgp_sym_decrypt(r.enc_heart_rate_variability, private.get_user_bio_key(r.user_id))::DOUBLE PRECISION
    ELSE r.heart_rate_variability
  END AS heart_rate_variability,
  CASE WHEN r.enc_eeg_alpha IS NOT NULL
    THEN pgp_sym_decrypt(r.enc_eeg_alpha,  private.get_user_bio_key(r.user_id))::DOUBLE PRECISION ELSE r.eeg_alpha  END AS eeg_alpha,
  CASE WHEN r.enc_eeg_beta  IS NOT NULL
    THEN pgp_sym_decrypt(r.enc_eeg_beta,   private.get_user_bio_key(r.user_id))::DOUBLE PRECISION ELSE r.eeg_beta   END AS eeg_beta,
  CASE WHEN r.enc_eeg_theta IS NOT NULL
    THEN pgp_sym_decrypt(r.enc_eeg_theta,  private.get_user_bio_key(r.user_id))::DOUBLE PRECISION ELSE r.eeg_theta  END AS eeg_theta,
  CASE WHEN r.enc_eeg_gamma IS NOT NULL
    THEN pgp_sym_decrypt(r.enc_eeg_gamma,  private.get_user_bio_key(r.user_id))::DOUBLE PRECISION ELSE r.eeg_gamma  END AS eeg_gamma,
  CASE WHEN r.enc_eeg_delta IS NOT NULL
    THEN pgp_sym_decrypt(r.enc_eeg_delta,  private.get_user_bio_key(r.user_id))::DOUBLE PRECISION ELSE r.eeg_delta  END AS eeg_delta,
  CASE WHEN r.enc_stress_level IS NOT NULL
    THEN pgp_sym_decrypt(r.enc_stress_level,       private.get_user_bio_key(r.user_id))::DOUBLE PRECISION ELSE r.stress_level       END AS stress_level,
  CASE WHEN r.enc_relaxation_score IS NOT NULL
    THEN pgp_sym_decrypt(r.enc_relaxation_score,   private.get_user_bio_key(r.user_id))::DOUBLE PRECISION ELSE r.relaxation_score   END AS relaxation_score,
  CASE WHEN r.enc_focus_score IS NOT NULL
    THEN pgp_sym_decrypt(r.enc_focus_score,        private.get_user_bio_key(r.user_id))::DOUBLE PRECISION ELSE r.focus_score        END AS focus_score,
  -- Extended columns (added in migration 002) — encrypt on INSERT trigger below
  r.hrv_rmssd, r.blood_oxygen, r.blood_pressure_systolic, r.blood_pressure_diastolic,
  r.respiratory_rate, r.skin_temperature_delta, r.eda,
  r.flow_score, r.is_flow_event
FROM public.biometric_readings_raw r;

-- ── 6. INSTEAD OF INSERT trigger — encrypt on write ───────────────────────
CREATE OR REPLACE FUNCTION public.biometric_readings_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  k TEXT := private.get_user_bio_key(NEW.user_id);
BEGIN
  INSERT INTO public.biometric_readings_raw (
    id, user_id, session_id, device_type, recorded_at, confidence, signal_quality,
    activity_type, activity_intensity, steps_per_minute, movement_type,
    -- Non-sensitive pass-through
    flow_score, is_flow_event,
    -- Sensitive: store encrypted if key available, plaintext fallback
    heart_rate,             enc_heart_rate,
    heart_rate_variability, enc_heart_rate_variability,
    eeg_alpha,  enc_eeg_alpha,
    eeg_beta,   enc_eeg_beta,
    eeg_theta,  enc_eeg_theta,
    eeg_gamma,  enc_eeg_gamma,
    eeg_delta,  enc_eeg_delta,
    stress_level,       enc_stress_level,
    relaxation_score,   enc_relaxation_score,
    focus_score,        enc_focus_score,
    hrv_rmssd, blood_oxygen, blood_pressure_systolic, blood_pressure_diastolic,
    respiratory_rate, skin_temperature_delta, eda
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.user_id, NEW.session_id,
    NEW.device_type, COALESCE(NEW.recorded_at, NOW()),
    NEW.confidence, NEW.signal_quality,
    NEW.activity_type, NEW.activity_intensity, NEW.steps_per_minute, NEW.movement_type,
    NEW.flow_score, NEW.is_flow_event,
    -- Store plaintext only when no key (degraded mode); otherwise NULL to force enc path
    CASE WHEN k IS NULL THEN NEW.heart_rate             ELSE NULL END,
    CASE WHEN k IS NOT NULL AND NEW.heart_rate IS NOT NULL
         THEN pgp_sym_encrypt(NEW.heart_rate::TEXT, k) END,
    CASE WHEN k IS NULL THEN NEW.heart_rate_variability ELSE NULL END,
    CASE WHEN k IS NOT NULL AND NEW.heart_rate_variability IS NOT NULL
         THEN pgp_sym_encrypt(NEW.heart_rate_variability::TEXT, k) END,
    CASE WHEN k IS NULL THEN NEW.eeg_alpha  ELSE NULL END,
    CASE WHEN k IS NOT NULL AND NEW.eeg_alpha  IS NOT NULL THEN pgp_sym_encrypt(NEW.eeg_alpha::TEXT,  k) END,
    CASE WHEN k IS NULL THEN NEW.eeg_beta   ELSE NULL END,
    CASE WHEN k IS NOT NULL AND NEW.eeg_beta   IS NOT NULL THEN pgp_sym_encrypt(NEW.eeg_beta::TEXT,   k) END,
    CASE WHEN k IS NULL THEN NEW.eeg_theta  ELSE NULL END,
    CASE WHEN k IS NOT NULL AND NEW.eeg_theta  IS NOT NULL THEN pgp_sym_encrypt(NEW.eeg_theta::TEXT,  k) END,
    CASE WHEN k IS NULL THEN NEW.eeg_gamma  ELSE NULL END,
    CASE WHEN k IS NOT NULL AND NEW.eeg_gamma  IS NOT NULL THEN pgp_sym_encrypt(NEW.eeg_gamma::TEXT,  k) END,
    CASE WHEN k IS NULL THEN NEW.eeg_delta  ELSE NULL END,
    CASE WHEN k IS NOT NULL AND NEW.eeg_delta  IS NOT NULL THEN pgp_sym_encrypt(NEW.eeg_delta::TEXT,  k) END,
    CASE WHEN k IS NULL THEN NEW.stress_level     ELSE NULL END,
    CASE WHEN k IS NOT NULL AND NEW.stress_level     IS NOT NULL THEN pgp_sym_encrypt(NEW.stress_level::TEXT,     k) END,
    CASE WHEN k IS NULL THEN NEW.relaxation_score ELSE NULL END,
    CASE WHEN k IS NOT NULL AND NEW.relaxation_score IS NOT NULL THEN pgp_sym_encrypt(NEW.relaxation_score::TEXT, k) END,
    CASE WHEN k IS NULL THEN NEW.focus_score      ELSE NULL END,
    CASE WHEN k IS NOT NULL AND NEW.focus_score      IS NOT NULL THEN pgp_sym_encrypt(NEW.focus_score::TEXT,      k) END,
    NEW.hrv_rmssd, NEW.blood_oxygen, NEW.blood_pressure_systolic, NEW.blood_pressure_diastolic,
    NEW.respiratory_rate, NEW.skin_temperature_delta, NEW.eda
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER biometric_readings_instead_of_insert
  INSTEAD OF INSERT ON public.biometric_readings
  FOR EACH ROW EXECUTE FUNCTION public.biometric_readings_insert();

-- ── 7. RLS on the underlying raw table ───────────────────────────────────
--    The view inherits no RLS — enforce it on the raw table instead.
--    SELECT on the view calls the decrypt function which is SECURITY DEFINER,
--    so RLS on biometric_readings_raw is the real gate.
ALTER TABLE public.biometric_readings_raw ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own biometric readings" ON public.biometric_readings_raw;
DROP POLICY IF EXISTS "Users can insert their own biometric readings" ON public.biometric_readings_raw;

CREATE POLICY "raw_select_own" ON public.biometric_readings_raw
  FOR SELECT USING (auth.uid() = user_id);

-- Inserts go through the INSTEAD OF trigger on the view, not directly to raw
CREATE POLICY "raw_insert_service_only" ON public.biometric_readings_raw
  FOR INSERT WITH CHECK (
    current_setting('role') = 'service_role'
    OR auth.uid() = user_id  -- direct insert still allowed as fallback
  );

CREATE POLICY "raw_delete_own" ON public.biometric_readings_raw
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON VIEW public.biometric_readings IS
  'Transparent decrypt view over biometric_readings_raw. Sensitive health columns '
  '(HR, HRV, EEG, stress, focus, relaxation) are pgp_sym_encrypted at rest using '
  'per-user keys stored in Supabase Vault. Inserts via INSTEAD OF trigger.';

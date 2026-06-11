-- ============================================================
-- FLOWSTATE MIGRATION 003 — C-2: Vault key management
-- Requires: Supabase Dashboard > Extensions > vault  (enable first)
-- ============================================================

-- Rename raw key column if it exists (backward compat)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='encryption_keys'
      AND column_name='encrypted_key'
  ) THEN
    ALTER TABLE public.encryption_keys RENAME COLUMN encrypted_key TO encrypted_key_deprecated;
  END IF;
END; $$;

ALTER TABLE public.encryption_keys
  ADD COLUMN IF NOT EXISTS key_reference TEXT,          -- vault secret name
  ADD COLUMN IF NOT EXISTS key_provider  TEXT DEFAULT 'supabase_vault',
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

-- Lock down: no user can directly read encryption_keys
DROP POLICY IF EXISTS "Users can view own encryption key"   ON public.encryption_keys;
DROP POLICY IF EXISTS "Users can insert own encryption key" ON public.encryption_keys;
CREATE POLICY "service_role_only_keys" ON public.encryption_keys USING (FALSE);
REVOKE ALL ON public.encryption_keys FROM authenticated, anon;
GRANT ALL ON public.encryption_keys TO service_role;

-- Store user key in Vault, record reference
CREATE OR REPLACE FUNCTION public.store_user_key_in_vault(p_user_id UUID, p_key_b64 TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE
  v_name TEXT := 'flowstate_user_key_' || p_user_id::TEXT;
  v_id   UUID;
BEGIN
  SELECT vault.create_secret(p_key_b64, v_name,
    'AES-256 key for FLOWSTATE user ' || p_user_id::TEXT) INTO v_id;
  INSERT INTO public.encryption_keys (user_id, key_reference, key_provider)
  VALUES (p_user_id, v_name, 'supabase_vault')
  ON CONFLICT (user_id) DO UPDATE SET key_reference=EXCLUDED.key_reference, updated_at=NOW();
  RETURN v_name;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Vault storage failed for user %: %. Enable Supabase Vault extension.', p_user_id, SQLERRM;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_user_key_in_vault(UUID, TEXT) TO service_role;


-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Secure table to store encryption key (RLS enabled, no policies = no public access)
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text UNIQUE NOT NULL,
  key_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;
-- No RLS policies = no public/authenticated access. Only accessible via security definer functions.

-- Generate and store a random 256-bit encryption key
INSERT INTO public.encryption_keys (key_name, key_value)
VALUES ('app_encryption_key', encode(gen_random_bytes(32), 'hex'));

-- Encrypt function (security definer to access key table)
CREATE OR REPLACE FUNCTION public.encrypt_sensitive(plain_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enc_key text;
BEGIN
  IF plain_text IS NULL THEN RETURN NULL; END IF;
  SELECT key_value INTO enc_key FROM public.encryption_keys WHERE key_name = 'app_encryption_key';
  RETURN encode(pgp_sym_encrypt(plain_text, enc_key), 'base64');
END;
$$;

-- Decrypt function (security definer to access key table)
CREATE OR REPLACE FUNCTION public.decrypt_sensitive(encrypted_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enc_key text;
BEGIN
  IF encrypted_text IS NULL THEN RETURN NULL; END IF;
  SELECT key_value INTO enc_key FROM public.encryption_keys WHERE key_name = 'app_encryption_key';
  RETURN pgp_sym_decrypt(decode(encrypted_text, 'base64'), enc_key);
EXCEPTION WHEN OTHERS THEN
  -- If decryption fails (data stored before encryption was enabled), return as-is
  RETURN encrypted_text;
END;
$$;

-- Auto-encrypt trigger for music_tokens
CREATE OR REPLACE FUNCTION public.trigger_encrypt_music_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enc_key text;
BEGIN
  SELECT key_value INTO enc_key FROM public.encryption_keys WHERE key_name = 'app_encryption_key';
  IF NEW.music_user_token IS NOT NULL THEN
    -- Only encrypt if not already encrypted (base64-encoded pgp starts with 'ww' or similar)
    BEGIN
      PERFORM pgp_sym_decrypt(decode(NEW.music_user_token, 'base64'), enc_key);
      -- If decryption succeeds, it's already encrypted - leave as-is
    EXCEPTION WHEN OTHERS THEN
      -- Not encrypted yet, encrypt it
      NEW.music_user_token := encode(pgp_sym_encrypt(NEW.music_user_token, enc_key), 'base64');
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER encrypt_music_token_trigger
BEFORE INSERT OR UPDATE ON public.music_tokens
FOR EACH ROW EXECUTE FUNCTION public.trigger_encrypt_music_token();

-- Auto-encrypt trigger for push_subscriptions
CREATE OR REPLACE FUNCTION public.trigger_encrypt_push_credentials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enc_key text;
BEGIN
  SELECT key_value INTO enc_key FROM public.encryption_keys WHERE key_name = 'app_encryption_key';
  
  -- Encrypt p256dh
  IF NEW.p256dh IS NOT NULL THEN
    BEGIN
      PERFORM pgp_sym_decrypt(decode(NEW.p256dh, 'base64'), enc_key);
    EXCEPTION WHEN OTHERS THEN
      NEW.p256dh := encode(pgp_sym_encrypt(NEW.p256dh, enc_key), 'base64');
    END;
  END IF;
  
  -- Encrypt auth
  IF NEW.auth IS NOT NULL THEN
    BEGIN
      PERFORM pgp_sym_decrypt(decode(NEW.auth, 'base64'), enc_key);
    EXCEPTION WHEN OTHERS THEN
      NEW.auth := encode(pgp_sym_encrypt(NEW.auth, enc_key), 'base64');
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER encrypt_push_credentials_trigger
BEFORE INSERT OR UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.trigger_encrypt_push_credentials();

-- RPC function to get decrypted push subscriptions (for edge functions via service role)
CREATE OR REPLACE FUNCTION public.get_decrypted_push_subscriptions(target_user_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, user_id uuid, endpoint text, p256dh text, auth text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id,
    ps.user_id,
    ps.endpoint,
    public.decrypt_sensitive(ps.p256dh) AS p256dh,
    public.decrypt_sensitive(ps.auth) AS auth
  FROM public.push_subscriptions ps
  WHERE (target_user_id IS NULL OR ps.user_id = target_user_id);
END;
$$;

-- RPC function to get decrypted music token
CREATE OR REPLACE FUNCTION public.get_decrypted_music_token(target_user_id uuid)
RETURNS TABLE(id uuid, user_id uuid, provider text, music_user_token text, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mt.id,
    mt.user_id,
    mt.provider,
    public.decrypt_sensitive(mt.music_user_token) AS music_user_token,
    mt.created_at,
    mt.updated_at
  FROM public.music_tokens mt
  WHERE mt.user_id = target_user_id;
END;
$$;

-- Encrypt any existing plaintext data
-- (Must be done via direct SQL since triggers would try to double-encrypt)
-- We do this by temporarily disabling triggers, encrypting, then re-enabling

ALTER TABLE public.music_tokens DISABLE TRIGGER encrypt_music_token_trigger;
ALTER TABLE public.push_subscriptions DISABLE TRIGGER encrypt_push_credentials_trigger;

UPDATE public.music_tokens 
SET music_user_token = public.encrypt_sensitive(music_user_token) 
WHERE music_user_token IS NOT NULL;

UPDATE public.push_subscriptions 
SET p256dh = public.encrypt_sensitive(p256dh),
    auth = public.encrypt_sensitive(auth);

ALTER TABLE public.music_tokens ENABLE TRIGGER encrypt_music_token_trigger;
ALTER TABLE public.push_subscriptions ENABLE TRIGGER encrypt_push_credentials_trigger;

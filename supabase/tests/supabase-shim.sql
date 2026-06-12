-- Supabase environment shim for local migration validation (PG16)
DO $$ BEGIN
  BEGIN CREATE ROLE anon NOLOGIN;          EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE ROLE service_role NOLOGIN;  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  created_at timestamptz DEFAULT now()
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

CREATE SCHEMA extensions;

-- vault stub
CREATE SCHEMA vault;
CREATE TABLE vault.secrets (
  id uuid DEFAULT gen_random_uuid(),
  name text UNIQUE,
  secret text,
  description text
);
CREATE FUNCTION vault.create_secret(p_secret text, p_name text, p_description text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid := gen_random_uuid();
BEGIN
  INSERT INTO vault.secrets(id, name, secret, description)
  VALUES (v, p_name, p_secret, p_description)
  ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
  RETURN v;
END $$;

-- pg_cron stub (schema + schedule function only)
CREATE SCHEMA cron;
CREATE SEQUENCE cron.jobid_seq;
CREATE TABLE cron.job (
  jobid bigint DEFAULT nextval('cron.jobid_seq') PRIMARY KEY,
  jobname text UNIQUE,
  schedule text,
  command text
);
CREATE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v bigint;
BEGIN
  INSERT INTO cron.job(jobname, schedule, command)
  VALUES (job_name, schedule, command)
  ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command
  RETURNING jobid INTO v;
  RETURN v;
END $$;

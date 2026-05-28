-- =============================================================================
-- BioMusic v2 — consolidated schema
-- Source of truth for the redesigned data model. Run on a fresh project with
-- `supabase db reset`. Existing deployments should run this against a new
-- project and backfill (the legacy → v2 column mapping is documented in
-- docs/ARCHITECTURE.md).
--
-- Conventions:
--   * Every user-owned table has RLS enabled and policies scoped to auth.uid().
--   * Sensitive provider/push secrets are encrypted at rest (pgcrypto).
--   * High-volume telemetry (biometric_readings) is indexed for time-series
--     reads and is the first candidate for monthly partitioning at scale.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  onboarded    boolean not null default false,
  preferences  jsonb   not null default '{"theme":"dark","notifications":true,"autoplay":true}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: owner read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: owner upsert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: owner update" on public.profiles for update using (auth.uid() = id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-provision a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- activities  (display metadata; the engine's targets live in @biomusic/core)
-- ---------------------------------------------------------------------------
create table public.activities (
  key         text primary key,
  label       text not null,
  description text,
  icon        text,
  sort_order  int  not null default 0
);
alter table public.activities enable row level security;
create policy "activities: public read" on public.activities for select using (true);

insert into public.activities (key, label, description, icon, sort_order) values
  ('workout',    'Workout',    'High-energy music that drives your training intensity.', 'dumbbell', 1),
  ('study',      'Study',      'Focus-enhancing music for deep concentration.',          'book-open', 2),
  ('relax',      'Relax',      'Calming music for unwinding.',                            'coffee', 3),
  ('sleep',      'Sleep',      'Gentle soundscapes to help you drift off.',               'moon', 4),
  ('commute',    'Commute',    'Steady, motivating music for the journey.',               'car', 5),
  ('meditation', 'Meditation', 'Mindful, ambient music for inner stillness.',             'brain', 6);

-- ---------------------------------------------------------------------------
-- tracks  (shared catalogue, deduped per provider; features on Spotify scale)
-- ---------------------------------------------------------------------------
create table public.tracks (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,
  provider_track_id text not null,
  title             text not null,
  artist            text not null,
  album             text,
  duration_ms       int,
  tempo             real,
  energy            real check (energy between 0 and 1),
  valence           real check (valence between 0 and 1),
  danceability      real check (danceability between 0 and 1),
  artwork_url       text,
  preview_url       text,
  created_at        timestamptz not null default now(),
  unique (provider, provider_track_id)
);
alter table public.tracks enable row level security;
create policy "tracks: authenticated read" on public.tracks for select to authenticated using (true);
-- Writes happen via the service role (adaptive service), which bypasses RLS.

-- ---------------------------------------------------------------------------
-- sessions  (a listening session tied to an activity)
-- ---------------------------------------------------------------------------
create table public.sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users on delete cascade,
  activity          text not null references public.activities(key),
  name              text,
  notes             text,
  status            text not null default 'active' check (status in ('active','completed','abandoned')),
  target_flow_state text not null default 'in_flow',
  mood_before       text,
  mood_after        text,
  avg_flow_score    real,
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  created_at        timestamptz not null default now()
);
alter table public.sessions enable row level security;
create policy "sessions: owner all" on public.sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index sessions_user_started_idx on public.sessions (user_id, started_at desc);
create index sessions_user_status_idx  on public.sessions (user_id, status);

-- ---------------------------------------------------------------------------
-- session_tracks  (what played during a session)
-- ---------------------------------------------------------------------------
create table public.session_tracks (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.sessions on delete cascade,
  track_id         uuid references public.tracks on delete set null,
  title            text not null,
  artist           text not null,
  position         int  not null default 0,
  played_at        timestamptz not null default now(),
  play_duration_ms int,
  skipped          boolean not null default false
);
alter table public.session_tracks enable row level security;
create policy "session_tracks: owner read" on public.session_tracks for select
  using (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "session_tracks: owner write" on public.session_tracks for insert
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()));
create index session_tracks_session_idx on public.session_tracks (session_id, position);

-- ---------------------------------------------------------------------------
-- biometric_readings  (high-volume time-series telemetry)
-- ---------------------------------------------------------------------------
create table public.biometric_readings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users on delete cascade,
  session_id        uuid references public.sessions on delete cascade,
  recorded_at       timestamptz not null default now(),
  heart_rate        int,
  hrv               real,
  stress_level      real,
  focus_score       real,
  relaxation_score  real,
  meditation_score  real,
  eeg_alpha         real,
  eeg_beta          real,
  eeg_theta         real,
  eeg_gamma         real,
  eeg_delta         real,
  device_type       text,
  created_at        timestamptz not null default now()
);
alter table public.biometric_readings enable row level security;
create policy "biometrics: owner read"   on public.biometric_readings for select using (auth.uid() = user_id);
create policy "biometrics: owner insert" on public.biometric_readings for insert with check (auth.uid() = user_id);
create policy "biometrics: owner delete" on public.biometric_readings for delete using (auth.uid() = user_id);
create index biometrics_session_time_idx on public.biometric_readings (session_id, recorded_at desc);
create index biometrics_user_time_idx    on public.biometric_readings (user_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- track_feedback  (thumbs up/down — fuels personalised preferences)
-- ---------------------------------------------------------------------------
create table public.track_feedback (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  track_title   text not null,
  track_artist  text not null,
  feedback      text not null check (feedback in ('up','down')),
  activity      text,
  target_tempo  int,
  target_energy numeric(3,2),
  context       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
alter table public.track_feedback enable row level security;
create policy "feedback: owner all" on public.track_feedback for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index feedback_user_activity_idx on public.track_feedback (user_id, activity);
create index feedback_user_recent_idx   on public.track_feedback (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- generated_playlists  (AI/deterministic playlists)
-- ---------------------------------------------------------------------------
create table public.generated_playlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  activity    text not null references public.activities(key),
  name        text not null,
  description text,
  reasoning   text,
  tracks      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
alter table public.generated_playlists enable row level security;
create policy "playlists: owner all" on public.generated_playlists for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index playlists_user_recent_idx on public.generated_playlists (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Encrypted secrets: provider tokens + web-push credentials
-- ---------------------------------------------------------------------------
create table public.encryption_keys (
  id         uuid primary key default gen_random_uuid(),
  key_name   text unique not null,
  key_value  text not null,
  created_at timestamptz not null default now()
);
alter table public.encryption_keys enable row level security;
-- No policies → unreachable except via SECURITY DEFINER functions below.
insert into public.encryption_keys (key_name, key_value)
values ('app_encryption_key', encode(gen_random_bytes(32), 'hex'));

create or replace function public.encrypt_secret(plain text)
returns text language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if plain is null then return null; end if;
  select key_value into k from public.encryption_keys where key_name = 'app_encryption_key';
  return encode(pgp_sym_encrypt(plain, k), 'base64');
end; $$;

create or replace function public.decrypt_secret(enc text)
returns text language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if enc is null then return null; end if;
  select key_value into k from public.encryption_keys where key_name = 'app_encryption_key';
  return pgp_sym_decrypt(decode(enc, 'base64'), k);
exception when others then
  return enc; -- tolerate legacy plaintext
end; $$;

create table public.music_tokens (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references auth.users on delete cascade,
  provider         text not null default 'spotify',
  music_user_token text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.music_tokens enable row level security;
create policy "music_tokens: owner all" on public.music_tokens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger music_tokens_updated_at before update on public.music_tokens
  for each row execute function public.set_updated_at();

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
create policy "push: owner all" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger push_subscriptions_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

-- Encrypt-on-write triggers (idempotent: skip values that already decrypt).
create or replace function public.encrypt_music_token()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text;
begin
  select key_value into k from public.encryption_keys where key_name = 'app_encryption_key';
  if new.music_user_token is not null then
    begin
      perform pgp_sym_decrypt(decode(new.music_user_token, 'base64'), k);
    exception when others then
      new.music_user_token := encode(pgp_sym_encrypt(new.music_user_token, k), 'base64');
    end;
  end if;
  return new;
end; $$;
create trigger music_tokens_encrypt before insert or update on public.music_tokens
  for each row execute function public.encrypt_music_token();

create or replace function public.encrypt_push_credentials()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text;
begin
  select key_value into k from public.encryption_keys where key_name = 'app_encryption_key';
  begin perform pgp_sym_decrypt(decode(new.p256dh, 'base64'), k);
  exception when others then new.p256dh := encode(pgp_sym_encrypt(new.p256dh, k), 'base64'); end;
  begin perform pgp_sym_decrypt(decode(new.auth, 'base64'), k);
  exception when others then new.auth := encode(pgp_sym_encrypt(new.auth, k), 'base64'); end;
  return new;
end; $$;
create trigger push_subscriptions_encrypt before insert or update on public.push_subscriptions
  for each row execute function public.encrypt_push_credentials();

-- Service-role accessors that return decrypted secrets to edge functions.
create or replace function public.get_decrypted_push_subscriptions(target_user_id uuid default null)
returns table(id uuid, user_id uuid, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select ps.id, ps.user_id, ps.endpoint,
           public.decrypt_secret(ps.p256dh), public.decrypt_secret(ps.auth)
    from public.push_subscriptions ps
    where target_user_id is null or ps.user_id = target_user_id;
end; $$;

create or replace function public.get_decrypted_music_token(target_user_id uuid)
returns table(user_id uuid, provider text, music_user_token text)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select mt.user_id, mt.provider, public.decrypt_secret(mt.music_user_token)
    from public.music_tokens mt
    where mt.user_id = target_user_id;
end; $$;

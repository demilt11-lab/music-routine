
-- Add preferences column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"theme": "dark", "notifications": true, "autoplay": true}'::jsonb;

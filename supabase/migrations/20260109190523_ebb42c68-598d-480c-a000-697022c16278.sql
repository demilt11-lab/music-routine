-- Add apple_music_id column to songs table for Apple Music integration
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS apple_music_id text;

-- Create table for storing Apple Music user tokens
CREATE TABLE public.music_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'apple_music',
  music_user_token text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on music_tokens
ALTER TABLE public.music_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for music_tokens
CREATE POLICY "Users can view their own music tokens"
ON public.music_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own music tokens"
ON public.music_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own music tokens"
ON public.music_tokens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own music tokens"
ON public.music_tokens FOR DELETE
USING (auth.uid() = user_id);

-- Create table for storing biometric data history
CREATE TABLE public.biometric_readings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.listening_sessions(id) ON DELETE CASCADE,
  heart_rate integer,
  heart_rate_variability double precision,
  eeg_alpha double precision,
  eeg_beta double precision,
  eeg_theta double precision,
  eeg_gamma double precision,
  eeg_delta double precision,
  stress_level double precision,
  relaxation_score double precision,
  focus_score double precision,
  device_type text,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on biometric_readings
ALTER TABLE public.biometric_readings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for biometric_readings
CREATE POLICY "Users can view their own biometric readings"
ON public.biometric_readings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own biometric readings"
ON public.biometric_readings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own biometric readings"
ON public.biometric_readings FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updating music_tokens updated_at
CREATE TRIGGER update_music_tokens_updated_at
BEFORE UPDATE ON public.music_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster biometric queries
CREATE INDEX idx_biometric_readings_user_session ON public.biometric_readings(user_id, session_id);
CREATE INDEX idx_biometric_readings_recorded_at ON public.biometric_readings(recorded_at DESC);
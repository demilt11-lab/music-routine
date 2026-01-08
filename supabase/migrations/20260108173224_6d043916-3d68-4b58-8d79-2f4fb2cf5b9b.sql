-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create activity_types table
CREATE TABLE public.activity_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Activity types are viewable by everyone" ON public.activity_types FOR SELECT USING (true);

-- Insert default activity types
INSERT INTO public.activity_types (name, description, icon) VALUES
  ('sleep', 'Relaxing music to help you fall asleep', 'moon'),
  ('workout', 'High-energy music to power your exercise', 'dumbbell'),
  ('study', 'Focus-enhancing music for concentration', 'book-open'),
  ('relax', 'Calming music for unwinding', 'coffee'),
  ('commute', 'Music for your daily travel', 'car');

-- Create songs table
CREATE TABLE public.songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  duration_ms INTEGER,
  spotify_id TEXT,
  energy FLOAT,
  valence FLOAT,
  tempo FLOAT,
  danceability FLOAT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own songs" ON public.songs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own songs" ON public.songs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own songs" ON public.songs FOR DELETE USING (auth.uid() = user_id);

-- Create listening_sessions table
CREATE TABLE public.listening_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  activity_type_id UUID NOT NULL REFERENCES public.activity_types(id),
  name TEXT,
  notes TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  mood_before TEXT,
  mood_after TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.listening_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own sessions" ON public.listening_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sessions" ON public.listening_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sessions" ON public.listening_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sessions" ON public.listening_sessions FOR DELETE USING (auth.uid() = user_id);

-- Create session_songs junction table
CREATE TABLE public.session_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.listening_sessions(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  play_duration_ms INTEGER,
  skipped BOOLEAN DEFAULT false,
  UNIQUE(session_id, song_id, played_at)
);

ALTER TABLE public.session_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own session songs" ON public.session_songs FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.listening_sessions ls WHERE ls.id = session_id AND ls.user_id = auth.uid()));
CREATE POLICY "Users can insert their own session songs" ON public.session_songs FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.listening_sessions ls WHERE ls.id = session_id AND ls.user_id = auth.uid()));

-- Create generated_playlists table
CREATE TABLE public.generated_playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  activity_type_id UUID NOT NULL REFERENCES public.activity_types(id),
  name TEXT NOT NULL,
  description TEXT,
  song_recommendations JSONB,
  ai_reasoning TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own playlists" ON public.generated_playlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own playlists" ON public.generated_playlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own playlists" ON public.generated_playlists FOR DELETE USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
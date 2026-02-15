
-- Create track feedback table for thumbs-up/down preferences
CREATE TABLE public.track_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  track_title TEXT NOT NULL,
  track_artist TEXT NOT NULL,
  feedback TEXT NOT NULL CHECK (feedback IN ('up', 'down')),
  activity_type TEXT,
  target_tempo INTEGER,
  target_energy NUMERIC(3,2),
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.track_feedback ENABLE ROW LEVEL SECURITY;

-- Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
ON public.track_feedback FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
ON public.track_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own feedback
CREATE POLICY "Users can update their own feedback"
ON public.track_feedback FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own feedback
CREATE POLICY "Users can delete their own feedback"
ON public.track_feedback FOR DELETE
USING (auth.uid() = user_id);

-- Index for efficient lookups
CREATE INDEX idx_track_feedback_user_activity ON public.track_feedback (user_id, activity_type);
CREATE INDEX idx_track_feedback_user_recent ON public.track_feedback (user_id, created_at DESC);

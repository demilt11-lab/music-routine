/**
 * Hand-authored types for the v2 schema. In a full pipeline this file is
 * generated with `supabase gen types typescript`; it is checked in here so the
 * client is fully typed without a live database connection at build time.
 */

export type Activity = "workout" | "study" | "sleep" | "relax" | "commute" | "meditation";
export type SessionStatus = "active" | "completed" | "abandoned";
export type FeedbackValue = "up" | "down";

interface Timestamped {
  created_at: string;
}

export interface ProfileRow extends Timestamped {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  onboarded: boolean;
  preferences: { theme?: string; notifications?: boolean; autoplay?: boolean } & Record<string, unknown>;
  updated_at: string;
}

export interface ActivityRow {
  key: Activity;
  label: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
}

export interface SessionRow extends Timestamped {
  id: string;
  user_id: string;
  activity: Activity;
  name: string | null;
  notes: string | null;
  status: SessionStatus;
  target_flow_state: string;
  mood_before: string | null;
  mood_after: string | null;
  avg_flow_score: number | null;
  started_at: string;
  ended_at: string | null;
}

export interface SessionTrackRow {
  id: string;
  session_id: string;
  track_id: string | null;
  title: string;
  artist: string;
  position: number;
  played_at: string;
  play_duration_ms: number | null;
  skipped: boolean;
}

export interface BiometricReadingRow extends Timestamped {
  id: string;
  user_id: string;
  session_id: string | null;
  recorded_at: string;
  heart_rate: number | null;
  hrv: number | null;
  stress_level: number | null;
  focus_score: number | null;
  relaxation_score: number | null;
  meditation_score: number | null;
  eeg_alpha: number | null;
  eeg_beta: number | null;
  eeg_theta: number | null;
  eeg_gamma: number | null;
  eeg_delta: number | null;
  device_type: string | null;
}

export interface TrackFeedbackRow extends Timestamped {
  id: string;
  user_id: string;
  track_title: string;
  track_artist: string;
  feedback: FeedbackValue;
  activity: Activity | null;
  target_tempo: number | null;
  target_energy: number | null;
  context: Record<string, unknown>;
}

export interface GeneratedPlaylistRow extends Timestamped {
  id: string;
  user_id: string;
  activity: Activity;
  name: string;
  description: string | null;
  reasoning: string | null;
  tracks: unknown[];
}

type Row<T> = T;
type Insert<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

interface TableDef<R, Ins> {
  Row: Row<R>;
  Insert: Ins;
  Update: Partial<Ins>;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, Insert<ProfileRow, "created_at" | "updated_at" | "onboarded" | "preferences">>;
      activities: TableDef<ActivityRow, ActivityRow>;
      sessions: TableDef<
        SessionRow,
        Insert<
          SessionRow,
          "id" | "created_at" | "started_at" | "ended_at" | "status" | "target_flow_state" | "name" | "notes" | "mood_before" | "mood_after" | "avg_flow_score"
        >
      >;
      session_tracks: TableDef<SessionTrackRow, Insert<SessionTrackRow, "id" | "played_at" | "position" | "skipped" | "track_id" | "play_duration_ms">>;
      biometric_readings: TableDef<BiometricReadingRow, Insert<BiometricReadingRow, "id" | "created_at">>;
      track_feedback: TableDef<TrackFeedbackRow, Insert<TrackFeedbackRow, "id" | "created_at" | "context">>;
      generated_playlists: TableDef<GeneratedPlaylistRow, Insert<GeneratedPlaylistRow, "id" | "created_at">>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { activity: Activity };
    CompositeTypes: Record<string, never>;
  };
}

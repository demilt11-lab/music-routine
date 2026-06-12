export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_types: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      biometric_readings: {
        Row: {
          created_at: string
          device_type: string | null
          eeg_alpha: number | null
          eeg_beta: number | null
          eeg_delta: number | null
          eeg_gamma: number | null
          eeg_theta: number | null
          focus_score: number | null
          heart_rate: number | null
          heart_rate_variability: number | null
          id: string
          recorded_at: string
          relaxation_score: number | null
          session_id: string | null
          stress_level: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          eeg_alpha?: number | null
          eeg_beta?: number | null
          eeg_delta?: number | null
          eeg_gamma?: number | null
          eeg_theta?: number | null
          focus_score?: number | null
          heart_rate?: number | null
          heart_rate_variability?: number | null
          id?: string
          recorded_at?: string
          relaxation_score?: number | null
          session_id?: string | null
          stress_level?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_type?: string | null
          eeg_alpha?: number | null
          eeg_beta?: number | null
          eeg_delta?: number | null
          eeg_gamma?: number | null
          eeg_theta?: number | null
          focus_score?: number | null
          heart_rate?: number | null
          heart_rate_variability?: number | null
          id?: string
          recorded_at?: string
          relaxation_score?: number | null
          session_id?: string | null
          stress_level?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "biometric_readings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "listening_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      encryption_keys: {
        Row: {
          created_at: string
          id: string
          key_name: string
          key_value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_name: string
          key_value: string
        }
        Update: {
          created_at?: string
          id?: string
          key_name?: string
          key_value?: string
        }
        Relationships: []
      }
      generated_playlists: {
        Row: {
          activity_type_id: string
          ai_reasoning: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          song_recommendations: Json | null
          user_id: string
        }
        Insert: {
          activity_type_id: string
          ai_reasoning?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          song_recommendations?: Json | null
          user_id: string
        }
        Update: {
          activity_type_id?: string
          ai_reasoning?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          song_recommendations?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_playlists_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
        ]
      }
      listening_sessions: {
        Row: {
          activity_type_id: string
          avg_heart_rate: number | null
          avg_hrv: number | null
          biometric_device_id: string | null
          created_at: string
          dsp_provider: string | null
          duration_minutes: number | null
          ended_at: string | null
          flow_entry_time: string | null
          flow_events: Json | null
          flow_score: number | null
          id: string
          mood_after: string | null
          mood_before: string | null
          name: string | null
          notes: string | null
          peak_flow_duration_minutes: number | null
          post_session_report: Json | null
          predicted_flow_potential: string | null
          readiness_score: number | null
          started_at: string
          state_log: Json | null
          time_in_flow_minutes: number | null
          trigger_log: Json | null
          user_id: string
        }
        Insert: {
          activity_type_id: string
          avg_heart_rate?: number | null
          avg_hrv?: number | null
          biometric_device_id?: string | null
          created_at?: string
          dsp_provider?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          flow_entry_time?: string | null
          flow_events?: Json | null
          flow_score?: number | null
          id?: string
          mood_after?: string | null
          mood_before?: string | null
          name?: string | null
          notes?: string | null
          peak_flow_duration_minutes?: number | null
          post_session_report?: Json | null
          predicted_flow_potential?: string | null
          readiness_score?: number | null
          started_at?: string
          state_log?: Json | null
          time_in_flow_minutes?: number | null
          trigger_log?: Json | null
          user_id: string
        }
        Update: {
          activity_type_id?: string
          avg_heart_rate?: number | null
          avg_hrv?: number | null
          biometric_device_id?: string | null
          created_at?: string
          dsp_provider?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          flow_entry_time?: string | null
          flow_events?: Json | null
          flow_score?: number | null
          id?: string
          mood_after?: string | null
          mood_before?: string | null
          name?: string | null
          notes?: string | null
          peak_flow_duration_minutes?: number | null
          post_session_report?: Json | null
          predicted_flow_potential?: string | null
          readiness_score?: number | null
          started_at?: string
          state_log?: Json | null
          time_in_flow_minutes?: number | null
          trigger_log?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listening_sessions_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
        ]
      }
      music_tokens: {
        Row: {
          created_at: string
          id: string
          music_user_token: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          music_user_token?: string | null
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          music_user_token?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          biometric_consent_granted_at: string | null
          biometric_consent_version: string | null
          consent_ip_hash: string | null
          created_at: string
          data_processing_consent_granted_at: string | null
          display_name: string | null
          email: string | null
          gdpr_region: boolean | null
          healthkit_consent_granted_at: string | null
          id: string
          onboarding_completed: boolean
          preferences: Json | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          biometric_consent_granted_at?: string | null
          biometric_consent_version?: string | null
          consent_ip_hash?: string | null
          created_at?: string
          data_processing_consent_granted_at?: string | null
          display_name?: string | null
          email?: string | null
          gdpr_region?: boolean | null
          healthkit_consent_granted_at?: string | null
          id: string
          onboarding_completed?: boolean
          preferences?: Json | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          biometric_consent_granted_at?: string | null
          biometric_consent_version?: string | null
          consent_ip_hash?: string | null
          created_at?: string
          data_processing_consent_granted_at?: string | null
          display_name?: string | null
          email?: string | null
          gdpr_region?: boolean | null
          healthkit_consent_granted_at?: string | null
          id?: string
          onboarding_completed?: boolean
          preferences?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_songs: {
        Row: {
          id: string
          play_duration_ms: number | null
          played_at: string
          session_id: string
          skipped: boolean | null
          song_id: string
        }
        Insert: {
          id?: string
          play_duration_ms?: number | null
          played_at?: string
          session_id: string
          skipped?: boolean | null
          song_id: string
        }
        Update: {
          id?: string
          play_duration_ms?: number | null
          played_at?: string
          session_id?: string
          skipped?: boolean | null
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_songs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "listening_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          album: string | null
          apple_music_id: string | null
          artist: string
          created_at: string
          danceability: number | null
          duration_ms: number | null
          energy: number | null
          id: string
          spotify_id: string | null
          tempo: number | null
          title: string
          user_id: string | null
          valence: number | null
        }
        Insert: {
          album?: string | null
          apple_music_id?: string | null
          artist: string
          created_at?: string
          danceability?: number | null
          duration_ms?: number | null
          energy?: number | null
          id?: string
          spotify_id?: string | null
          tempo?: number | null
          title: string
          user_id?: string | null
          valence?: number | null
        }
        Update: {
          album?: string | null
          apple_music_id?: string | null
          artist?: string
          created_at?: string
          danceability?: number | null
          duration_ms?: number | null
          energy?: number | null
          id?: string
          spotify_id?: string | null
          tempo?: number | null
          title?: string
          user_id?: string | null
          valence?: number | null
        }
        Relationships: []
      }
      track_feedback: {
        Row: {
          activity_type: string | null
          context: Json | null
          created_at: string
          feedback: string
          id: string
          target_energy: number | null
          target_tempo: number | null
          track_artist: string
          track_title: string
          user_id: string
        }
        Insert: {
          activity_type?: string | null
          context?: Json | null
          created_at?: string
          feedback: string
          id?: string
          target_energy?: number | null
          target_tempo?: number | null
          track_artist: string
          track_title: string
          user_id: string
        }
        Update: {
          activity_type?: string | null
          context?: Json | null
          created_at?: string
          feedback?: string
          id?: string
          target_energy?: number | null
          target_tempo?: number | null
          track_artist?: string
          track_title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_biometric_baseline: {
        Row: {
          created_at: string | null
          eeg_baseline_alpha: number | null
          eeg_baseline_beta: number | null
          eeg_baseline_delta: number | null
          eeg_baseline_gamma: number | null
          eeg_baseline_theta: number | null
          established_at: string | null
          hrmax_estimate: number | null
          hrv_baseline_rmssd: number | null
          hrv_baseline_sdnn: number | null
          id: string
          last_updated_at: string | null
          resting_hr: number | null
          session_count: number | null
          stress_baseline: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          eeg_baseline_alpha?: number | null
          eeg_baseline_beta?: number | null
          eeg_baseline_delta?: number | null
          eeg_baseline_gamma?: number | null
          eeg_baseline_theta?: number | null
          established_at?: string | null
          hrmax_estimate?: number | null
          hrv_baseline_rmssd?: number | null
          hrv_baseline_sdnn?: number | null
          id?: string
          last_updated_at?: string | null
          resting_hr?: number | null
          session_count?: number | null
          stress_baseline?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          eeg_baseline_alpha?: number | null
          eeg_baseline_beta?: number | null
          eeg_baseline_delta?: number | null
          eeg_baseline_gamma?: number | null
          eeg_baseline_theta?: number | null
          established_at?: string | null
          hrmax_estimate?: number | null
          hrv_baseline_rmssd?: number | null
          hrv_baseline_sdnn?: number | null
          id?: string
          last_updated_at?: string | null
          resting_hr?: number | null
          session_count?: number | null
          stress_baseline?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_music_preferences: {
        Row: {
          activity_type: string
          created_at: string | null
          id: string
          last_updated: string | null
          like_count: number | null
          preferred_energy_avg: number | null
          preferred_tempo_avg: number | null
          session_count: number | null
          skip_count: number | null
          skip_rate: number | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          id?: string
          last_updated?: string | null
          like_count?: number | null
          preferred_energy_avg?: number | null
          preferred_tempo_avg?: number | null
          session_count?: number | null
          skip_count?: number | null
          skip_rate?: number | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          id?: string
          last_updated?: string | null
          like_count?: number | null
          preferred_energy_avg?: number | null
          preferred_tempo_avg?: number | null
          session_count?: number | null
          skip_count?: number | null
          skip_rate?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrypt_sensitive: { Args: { encrypted_text: string }; Returns: string }
      encrypt_sensitive: { Args: { plain_text: string }; Returns: string }
      get_decrypted_music_token: {
        Args: { target_user_id: string }
        Returns: {
          created_at: string
          id: string
          music_user_token: string
          provider: string
          updated_at: string
          user_id: string
        }[]
      }
      get_decrypted_push_subscriptions: {
        Args: { target_user_id?: string }
        Returns: {
          auth: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }[]
      }
      check_biometric_consent: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      compute_readiness: {
        Args: { p_user_id: string }
        Returns: Json
      }
      cleanup_orphan_sessions: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      delete_user_all_data: {
        Args: { p_user_id: string }
        Returns: Json
      }
      export_user_data: {
        Args: { p_user_id: string }
        Returns: Json
      }
      grant_biometric_consent: {
        Args: { p_user_id: string; p_version?: string; p_ip_hash?: string | null }
        Returns: undefined
      }
      purge_expired_biometric_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      revoke_biometric_consent: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      store_user_key_in_vault: {
        Args: { p_user_id: string; p_key_b64: string }
        Returns: string
      }
      upsert_music_preference: {
        Args: {
          p_user_id: string
          p_activity_type: string
          p_tempo: number
          p_energy: number
          p_feedback: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

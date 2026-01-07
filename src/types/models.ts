// TypeScript interfaces matching the FastAPI SQLAlchemy models

export interface User {
  id: number;
  username: string;
  is_active: boolean;
  spotify_access_token?: string | null;
  spotify_refresh_token?: string | null;
  spotify_expires_at?: number | null;
}

export interface Song {
  id: number;
  title: string;
  artist?: string | null;
  spotify_id?: string | null;
  url?: string | null;
}

export interface Session {
  id: number;
  name: string;
  created_at: string; // ISO datetime string
  user_id: number;
  notes?: string | null;
  songs: Song[];
}

// Auth types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface TokenPayload {
  sub: string;
  exp: number;
}

// Session CRUD types
export interface CreateSessionRequest {
  name: string;
  notes?: string;
}

export interface UpdateSessionRequest {
  name?: string;
  notes?: string;
}

export interface AddSongToSessionRequest {
  song_id: number;
}

// Spotify types
export interface SpotifyAuthUrl {
  auth_url: string;
}

export interface SpotifyConnectionStatus {
  connected: boolean;
  expires_at?: number | null;
}

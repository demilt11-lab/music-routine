// API service layer for FastAPI backend
import type {
  User,
  Song,
  Session,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  CreateSessionRequest,
  UpdateSessionRequest,
  SpotifyAuthUrl,
  SpotifyConnectionStatus,
} from "@/types/models";

// Configure your FastAPI backend URL here
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("token");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new ApiError(response.status, error.detail || "Request failed");
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: (data: LoginRequest): Promise<AuthResponse> =>
    request("/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: data.username,
        password: data.password,
      }),
    }),

  register: (data: RegisterRequest): Promise<User> =>
    request("/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getCurrentUser: (): Promise<User> => request("/users/me"),
};

// Sessions API
export const sessionsApi = {
  getAll: (): Promise<Session[]> => request("/sessions/"),

  getById: (id: number): Promise<Session> => request(`/sessions/${id}`),

  create: (data: CreateSessionRequest): Promise<Session> =>
    request("/sessions/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: UpdateSessionRequest): Promise<Session> =>
    request(`/sessions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<void> =>
    request(`/sessions/${id}`, {
      method: "DELETE",
    }),

  addSong: (sessionId: number, songId: number): Promise<Session> =>
    request(`/sessions/${sessionId}/songs/${songId}`, {
      method: "POST",
    }),

  removeSong: (sessionId: number, songId: number): Promise<Session> =>
    request(`/sessions/${sessionId}/songs/${songId}`, {
      method: "DELETE",
    }),
};

// Songs API
export const songsApi = {
  getAll: (): Promise<Song[]> => request("/songs/"),

  getById: (id: number): Promise<Song> => request(`/songs/${id}`),

  create: (data: Omit<Song, "id">): Promise<Song> =>
    request("/songs/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<void> =>
    request(`/songs/${id}`, {
      method: "DELETE",
    }),
};

// Spotify API
export const spotifyApi = {
  getAuthUrl: (): Promise<SpotifyAuthUrl> => request("/spotify/auth-url"),

  getConnectionStatus: (): Promise<SpotifyConnectionStatus> =>
    request("/spotify/status"),

  disconnect: (): Promise<void> =>
    request("/spotify/disconnect", {
      method: "POST",
    }),
};

export { ApiError };

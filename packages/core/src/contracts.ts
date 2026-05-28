import { z } from "zod";
import { ACTIVITIES } from "./types.js";

/**
 * Runtime-validated request/response contracts for the adaptive service API.
 * Importing these in both the client and the server keeps the wire format
 * honest: a change to a schema is a compile error on both sides.
 */

export const activitySchema = z.enum(ACTIVITIES);

export const eegBandsSchema = z.object({
  alpha: z.number(),
  beta: z.number(),
  theta: z.number(),
  gamma: z.number(),
  delta: z.number(),
});

export const biometricSampleSchema = z.object({
  recordedAt: z.string().datetime(),
  heartRate: z.number().min(20).max(240).optional(),
  hrv: z.number().min(0).max(500).optional(),
  stressLevel: z.number().min(0).max(100).optional(),
  focusScore: z.number().min(0).max(100).optional(),
  relaxationScore: z.number().min(0).max(100).optional(),
  eeg: eegBandsSchema.optional(),
  meditationScore: z.number().min(0).max(100).optional(),
  deviceType: z.string().max(64).optional(),
});

export const trackSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  durationMs: z.number().int().positive().optional(),
  tempo: z.number().optional(),
  energy: z.number().min(0).max(1).optional(),
  valence: z.number().min(0).max(1).optional(),
  danceability: z.number().min(0).max(1).optional(),
  provider: z.enum(["spotify", "apple_music", "jamendo", "youtube"]).optional(),
  providerTrackId: z.string().optional(),
  artworkUrl: z.string().url().optional(),
  previewUrl: z.string().url().optional(),
});

export const userPreferencesSchema = z.object({
  likedArtists: z.array(z.string()),
  dislikedArtists: z.array(z.string()),
  likedTempoRange: z.object({ min: z.number(), max: z.number() }).optional(),
  likedEnergyRange: z.object({ min: z.number(), max: z.number() }).optional(),
});

export const flowStateSchema = z.enum(["none", "entering", "in_flow", "exiting"]);

// POST /v1/adaptive/next
export const adaptiveRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  activity: activitySchema,
  sample: biometricSampleSchema,
  history: z.array(biometricSampleSchema).max(60).optional(),
  currentTrack: trackSchema.optional(),
  targetFlowState: flowStateSchema.optional(),
  /** When true, the service enriches reasoning copy with the LLM. */
  enrich: z.boolean().optional(),
});
export type AdaptiveRequest = z.infer<typeof adaptiveRequestSchema>;

// POST /v1/playlists/generate
export const playlistGenerateRequestSchema = z.object({
  activity: activitySchema,
  durationMinutes: z.number().int().min(5).max(240).default(30),
  seedTrack: trackSchema.optional(),
  notes: z.string().max(500).optional(),
});
export type PlaylistGenerateRequest = z.infer<typeof playlistGenerateRequestSchema>;

export const playlistGenerateResponseSchema = z.object({
  name: z.string(),
  description: z.string(),
  reasoning: z.string(),
  tracks: z.array(trackSchema),
});
export type PlaylistGenerateResponse = z.infer<typeof playlistGenerateResponseSchema>;

// POST /v1/biometrics:ingest  (batched, high-throughput)
export const biometricIngestRequestSchema = z.object({
  sessionId: z.string().uuid(),
  samples: z.array(biometricSampleSchema).min(1).max(200),
});
export type BiometricIngestRequest = z.infer<typeof biometricIngestRequestSchema>;

// GET /v1/providers/:provider/search
export const providerSearchQuerySchema = z.object({
  q: z.string().min(1).max(200).optional(),
  tempoMin: z.coerce.number().optional(),
  tempoMax: z.coerce.number().optional(),
  energyMin: z.coerce.number().optional(),
  energyMax: z.coerce.number().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ProviderSearchQuery = z.infer<typeof providerSearchQuerySchema>;

export const providerSearchResponseSchema = z.object({
  provider: z.string(),
  tracks: z.array(trackSchema),
});
export type ProviderSearchResponse = z.infer<typeof providerSearchResponseSchema>;

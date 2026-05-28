import type { MusicProviderId, Track } from "@biomusic/core";
import { jamendoProvider } from "./jamendo.js";
import { spotifyProvider } from "./spotify.js";

export interface SearchParams {
  q?: string;
  tempo?: { min: number; max: number };
  energy?: { min: number; max: number };
  limit: number;
}

export interface MusicProvider {
  readonly id: MusicProviderId;
  isConfigured(): boolean;
  search(params: SearchParams): Promise<Track[]>;
}

const registry: Partial<Record<MusicProviderId, MusicProvider>> = {
  jamendo: jamendoProvider,
  spotify: spotifyProvider,
};

export function getProvider(id: string): MusicProvider | null {
  return registry[id as MusicProviderId] ?? null;
}

export function listConfiguredProviders(): MusicProviderId[] {
  return (Object.values(registry) as MusicProvider[]).filter((p) => p.isConfigured()).map((p) => p.id);
}

/** Map a 0–1 energy band to descriptive search tags providers understand. */
export function energyTags(energy?: { min: number; max: number }): string[] {
  if (!energy) return [];
  const mid = (energy.min + energy.max) / 2;
  if (mid >= 0.75) return ["energetic", "upbeat"];
  if (mid >= 0.5) return ["groovy"];
  if (mid >= 0.3) return ["chill"];
  return ["ambient", "calm"];
}

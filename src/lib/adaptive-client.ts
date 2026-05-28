import { recommend, type AdaptiveInput, type AdaptiveRecommendation, type Track } from "@biomusic/core";
import type {
  AdaptiveRequest,
  BiometricIngestRequest,
  PlaylistGenerateRequest,
  PlaylistGenerateResponse,
} from "@biomusic/core/contracts";
import { env } from "./env";
import { getAccessToken } from "./supabase";

const BASE = env.VITE_ADAPTIVE_SERVICE_URL?.replace(/\/$/, "");

export interface AdaptiveNextResult {
  recommendation: AdaptiveRecommendation;
  candidates: Track[];
  /** True when produced locally because the service was unavailable. */
  local: boolean;
}

class AdaptiveServiceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AdaptiveServiceError";
  }
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  if (!BASE) throw new AdaptiveServiceError(0, "Adaptive service URL not configured");
  const token = await getAccessToken();
  if (!token) throw new AdaptiveServiceError(401, "Not authenticated");

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new AdaptiveServiceError(res.status, body?.error?.message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const adaptiveClient = {
  /**
   * Get the next recommendation. Always resolves: if the service is down or
   * unconfigured we fall back to the deterministic engine bundled in the client
   * so live sessions never stall.
   */
  async next(req: AdaptiveRequest): Promise<AdaptiveNextResult> {
    try {
      const result = await call<{ recommendation: AdaptiveRecommendation; candidates: Track[] }>("/v1/adaptive/next", {
        method: "POST",
        body: JSON.stringify(req),
      });
      return { ...result, local: false };
    } catch {
      // The validated request is structurally an AdaptiveInput at runtime; the
      // cast reconciles zod's inferred optionality with the core types.
      const recommendation = recommend({
        activity: req.activity,
        sample: req.sample,
        history: req.history,
        currentTrack: req.currentTrack,
        targetFlowState: req.targetFlowState,
      } as AdaptiveInput);
      return { recommendation, candidates: [], local: true };
    }
  },

  ingestBiometrics(req: BiometricIngestRequest): Promise<{ inserted: number }> {
    return call("/v1/biometrics/ingest", { method: "POST", body: JSON.stringify(req) });
  },

  generatePlaylist(req: PlaylistGenerateRequest): Promise<PlaylistGenerateResponse & { id: string | null }> {
    return call("/v1/playlists/generate", { method: "POST", body: JSON.stringify(req) });
  },
};

import type { AdaptiveInput, AdaptiveRecommendation, Track } from "@biomusic/core";
import type { PlaylistGenerateRequest } from "@biomusic/core/contracts";
import { loadEnv } from "./env.js";

/**
 * Optional LLM layer over an OpenAI-compatible gateway. Every export degrades
 * to a deterministic result when the gateway is unconfigured or fails, so the
 * product never hard-depends on a third-party model being up or paid for.
 */

export function isLlmEnabled(): boolean {
  const env = loadEnv();
  return Boolean(env.AI_GATEWAY_URL && env.AI_API_KEY);
}

async function chat(system: string, user: string, timeoutMs = 6000): Promise<string | null> {
  const env = loadEnv();
  if (!isLlmEnabled()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.AI_GATEWAY_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${env.AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.AI_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractJson<T>(content: string | null): T | null {
  if (!content) return null;
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

/** Replace the engine's terse copy with warmer, context-aware coaching text. */
export async function enrichRecommendation(
  rec: AdaptiveRecommendation,
  input: AdaptiveInput,
): Promise<Pick<AdaptiveRecommendation, "reasoning" | "flowPrediction">> {
  const system =
    "You are a music therapist. Given a deterministic recommendation, rewrite ONLY the " +
    "`reasoning` and `flowPrediction` fields as warm, concise coaching (max 2 sentences each). " +
    "Do not change the action or numeric targets. Reply as JSON: {\"reasoning\":\"\",\"flowPrediction\":\"\"}.";
  const user = JSON.stringify({
    activity: input.activity,
    sample: input.sample,
    decision: { action: rec.action, targetTempo: rec.targetTempo, targetEnergy: rec.targetEnergy },
  });
  const out = extractJson<{ reasoning?: string; flowPrediction?: string }>(await chat(system, user));
  return {
    reasoning: out?.reasoning?.trim() || rec.reasoning,
    flowPrediction: out?.flowPrediction?.trim() || rec.flowPrediction,
  };
}

/**
 * Curate/order a playlist from concrete candidate tracks. Falls back to the
 * candidates as-is so the endpoint still returns a usable playlist offline.
 */
export async function curatePlaylist(
  req: PlaylistGenerateRequest,
  candidates: Track[],
): Promise<{ name: string; description: string; reasoning: string; tracks: Track[] }> {
  const fallback = {
    name: `${capitalize(req.activity)} Flow`,
    description: `A ${req.durationMinutes}-minute ${req.activity} set tuned to your target tempo and energy.`,
    reasoning: "Ordered by ascending tempo to ease you into the target state, then held steady.",
    tracks: [...candidates].sort((a, b) => (a.tempo ?? 0) - (b.tempo ?? 0)),
  };
  if (!isLlmEnabled() || candidates.length === 0) return fallback;

  const system =
    "You are a playlist curator. From the provided candidate tracks, select and ORDER the best " +
    "set for the user's activity and duration. Only use tracks from the candidates (reference by index). " +
    'Reply as JSON: {"name":"","description":"","reasoning":"","order":[indices]}.';
  const user = JSON.stringify({
    activity: req.activity,
    durationMinutes: req.durationMinutes,
    notes: req.notes,
    candidates: candidates.map((t, i) => ({ i, title: t.title, artist: t.artist, tempo: t.tempo, energy: t.energy })),
  });
  const out = extractJson<{ name?: string; description?: string; reasoning?: string; order?: number[] }>(
    await chat(system, user, 9000),
  );
  if (!out?.order?.length) return fallback;

  const ordered = out.order
    .filter((i) => Number.isInteger(i) && i >= 0 && i < candidates.length)
    .map((i) => candidates[i]);
  return {
    name: out.name?.trim() || fallback.name,
    description: out.description?.trim() || fallback.description,
    reasoning: out.reasoning?.trim() || fallback.reasoning,
    tracks: ordered.length ? ordered : fallback.tracks,
  };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

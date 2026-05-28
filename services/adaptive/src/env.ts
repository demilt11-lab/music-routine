import { z } from "zod";

/**
 * Validate configuration once at boot. Required secrets fail fast; optional
 * integrations (LLM, providers, Redis) degrade gracefully when unset so the
 * service stays useful in local dev and partial deployments.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8787),

  // Supabase (required) — used for DB access and JWT verification.
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  // CORS — comma-separated allowlist. "*" permitted in dev only.
  ALLOWED_ORIGINS: z.string().default("*"),

  // Optional LLM gateway (OpenAI-compatible). Absent => deterministic only.
  AI_GATEWAY_URL: z.string().url().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("google/gemini-2.5-flash"),

  // Optional music providers.
  JAMENDO_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),

  // Optional Redis for distributed cache + rate limiting.
  REDIS_URL: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid service configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

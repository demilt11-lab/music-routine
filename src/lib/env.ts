import { z } from "zod";

/**
 * Validate the public (VITE_-prefixed) environment at startup so a
 * misconfigured deploy fails loudly in development instead of throwing opaque
 * runtime errors deep in the app. Only non-secret, browser-safe values belong
 * here — anything sensitive lives in the adaptive service or Supabase.
 */
const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  /** Base URL of the adaptive service, e.g. https://adaptive.biomusic.app */
  VITE_ADAPTIVE_SERVICE_URL: z.string().url().optional(),
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid web environment configuration:\n${issues}\n\nCopy .env.example to .env and fill it in.`);
}

export const env = parsed.data;

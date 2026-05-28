import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.js";

let client: SupabaseClient | null = null;

/**
 * Service-role Supabase client. Bypasses RLS, so it must only ever be used
 * after the caller's identity has been established by `requireAuth`, and every
 * query must be explicitly scoped to that user's id.
 */
export function getServiceClient(): SupabaseClient {
  if (client) return client;
  const env = loadEnv();
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

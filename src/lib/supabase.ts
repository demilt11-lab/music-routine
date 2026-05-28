import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * The single Supabase client for the web app. Handles auth + all direct CRUD
 * against RLS-protected tables (sessions, feedback, profile, history). Heavy or
 * secret work (adaptive recommendations, AI playlists, provider keys) goes
 * through the adaptive service instead — see `adaptive-client.ts`.
 *
 * Query results are typed at the boundary in each feature's `api.ts` against
 * the row types in `database.types.ts`. To get end-to-end generic typing on
 * the client, generate types with `supabase gen types typescript` and pass them
 * as `createClient<Database>(...)`.
 */
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  classifyBiometricState,
  resolveActivityProfile,
  type BiometricWindow,
} from "../_shared/classifier.ts";

// Pure logic lives in ../_shared/classifier.ts so the playlist-engine and the
// vitest suite share one implementation. Re-export for existing importers.
export * from "../_shared/classifier.ts";

const CORS = {
  "Access-Control-Allow-Origin":  Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Biometric windows are health data — require an authenticated user even
  // though this endpoint is pure computation.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
  }
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
  }

  try {
    const body = await req.json();
    const { window: bioWindow, activity_type } = body as {
      window: BiometricWindow;
      activity_type?: string;
    };

    const profile = resolveActivityProfile(activity_type ?? "study");
    const result  = classifyBiometricState(bioWindow, profile);

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

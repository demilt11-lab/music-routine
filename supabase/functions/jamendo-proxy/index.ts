import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ORIGIN } from "../_shared/cors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// JAMENDO_CLIENT_ID must be set as a Supabase secret:  supabase secrets set JAMENDO_CLIENT_ID=<id>
const JAMENDO_CLIENT_ID = Deno.env.get("JAMENDO_CLIENT_ID") ?? "b6747d04";
const JAMENDO_BASE = "https://api.jamendo.com/v3.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint") || "tracks";
    
    // Build Jamendo URL, forwarding all params except "endpoint"
    const jamendoUrl = new URL(`${JAMENDO_BASE}/${endpoint}`);
    jamendoUrl.searchParams.set("client_id", JAMENDO_CLIENT_ID);
    jamendoUrl.searchParams.set("format", "json");

    for (const [key, value] of url.searchParams.entries()) {
      if (key !== "endpoint") {
        jamendoUrl.searchParams.set(key, value);
      }
    }

    const response = await fetch(jamendoUrl.toString());
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Jamendo proxy error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

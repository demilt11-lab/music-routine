import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type FlowEvent = "FLOW_ENTERED" | "FLOW_SUSTAINED_30MIN" | "FLOW_DISRUPTED";

interface FlowState {
  in_flow: boolean;
  flow_entry_time: string | null;
  flow_duration_seconds: number;
  maintenance_mode: boolean;   // reduces reactive sensitivity in playlist engine
}

interface SessionFlowContext {
  current_state: "OPTIMAL" | "FLOW" | string;
  time_in_optimal_s: number;
  hr_std: number;
  focus_score: number | null;
  previous_flow: FlowState;
}

import { ORIGIN } from "../_shared/cors.ts";
const CORS = {
  "Access-Control-Allow-Origin":  ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function detectFlowTransition(ctx: SessionFlowContext): {
  event: FlowEvent | null;
  updated_flow: FlowState;
} {
  const { current_state, time_in_optimal_s, hr_std, focus_score, previous_flow } = ctx;

  const inOptimalState = current_state === "OPTIMAL" || current_state === "FLOW";
  const stableVitals   = hr_std < 6;
  const focusOk        = focus_score === null || focus_score > 70;
  const sustained10m   = time_in_optimal_s >= 600;
  const sustained30m   = time_in_optimal_s >= 1800;

  // FLOW_ENTERED: first time crossing 10-minute threshold
  if (!previous_flow.in_flow && inOptimalState && stableVitals && focusOk && sustained10m) {
    return {
      event: "FLOW_ENTERED",
      updated_flow: {
        in_flow: true,
        flow_entry_time: new Date(Date.now() - time_in_optimal_s * 1000).toISOString(),
        flow_duration_seconds: time_in_optimal_s,
        maintenance_mode: true,
      },
    };
  }

  // FLOW_SUSTAINED_30MIN milestone
  if (previous_flow.in_flow && sustained30m && previous_flow.flow_duration_seconds < 1800) {
    return {
      event: "FLOW_SUSTAINED_30MIN",
      updated_flow: { ...previous_flow, flow_duration_seconds: time_in_optimal_s },
    };
  }

  // FLOW_DISRUPTED: was in flow, now not optimal
  if (previous_flow.in_flow && !inOptimalState) {
    return {
      event: "FLOW_DISRUPTED",
      updated_flow: {
        in_flow: false,
        flow_entry_time: null,
        flow_duration_seconds: 0,
        maintenance_mode: false,
      },
    };
  }

  // Update duration if still in flow
  if (previous_flow.in_flow) {
    return {
      event: null,
      updated_flow: { ...previous_flow, flow_duration_seconds: time_in_optimal_s },
    };
  }

  return { event: null, updated_flow: previous_flow };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization");
  if (!authHeader)
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user)
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

  try {
    const body: { session_id: string; context: SessionFlowContext } = await req.json();
    const { session_id, context } = body;

    const { event, updated_flow } = detectFlowTransition(context);

    // Persist flow event to session log
    if (event && session_id) {
      const { data: session } = await supabase
        .from("listening_sessions")
        .select("flow_events, flow_entry_time, time_in_flow_minutes")
        .eq("id", session_id)
        .single();

      const existingEvents: unknown[] = session?.flow_events ?? [];
      const newEvent = { event, timestamp: new Date().toISOString(),
                         flow_duration_s: context.time_in_optimal_s };

      await supabase.from("listening_sessions").update({
        flow_events: [...existingEvents, newEvent],
        flow_entry_time: updated_flow.flow_entry_time ?? session?.flow_entry_time,
        time_in_flow_minutes: Math.round((context.time_in_optimal_s / 60) * 100) / 100,
      }).eq("id", session_id);
    }

    return new Response(JSON.stringify({ event, flow_state: updated_flow }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[flow-state-detector] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});

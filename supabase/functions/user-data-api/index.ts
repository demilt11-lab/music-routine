import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { ORIGIN } from "../_shared/cors.ts";
const CORS = {
  "Access-Control-Allow-Origin":  ORIGIN,
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const url    = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // GET ?action=export  — GDPR Article 20
    if (req.method === "GET" && action === "export") {
      const { data, error } = await supabase.rpc("export_user_data", { p_user_id: user.id });
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: {
          ...CORS,
          "Content-Type":        "application/json",
          "Content-Disposition": `attachment; filename="flowstate-data-${user.id}.json"`,
        },
      });
    }

    // DELETE ?action=delete — GDPR Article 17 / CCPA
    if (req.method === "DELETE" && action === "delete") {
      const { data, error } = await supabase.rpc("delete_user_all_data", { p_user_id: user.id });
      if (error) throw error;

      // Delete from auth.users via admin API
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await adminClient.auth.admin.deleteUser(user.id);

      return json({ ...data, auth_deleted: true });
    }

    // GET ?action=consent_status
    if (req.method === "GET" && action === "consent_status") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("biometric_consent_granted_at, biometric_consent_version, gdpr_region")
        .eq("id", user.id)
        .single();
      return json({
        has_consent:      !!profile?.biometric_consent_granted_at,
        consent_version:  profile?.biometric_consent_version,
        granted_at:       profile?.biometric_consent_granted_at,
        gdpr_region:      profile?.gdpr_region,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[user-data-api] error:", err);
    return json({ error: String(err) }, 500);
  }
});

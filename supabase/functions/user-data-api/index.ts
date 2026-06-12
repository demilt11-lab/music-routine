import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

  // Action comes from the query string (GET/DELETE) or a POST body, so the
  // frontend can use supabase.functions.invoke (which always POSTs).
  const url = new URL(req.url);
  let action = url.searchParams.get("action");
  if (!action && req.method === "POST") {
    try {
      const body = await req.json();
      action = body?.action ?? null;
    } catch {
      action = null;
    }
  }

  try {
    // GDPR Article 20 — portable data export
    if (action === "export") {
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

    // GDPR Article 17 / CCPA — full deletion
    if (action === "delete") {
      const { data, error } = await supabase.rpc("delete_user_all_data", { p_user_id: user.id });
      if (error) throw error;

      // The RPC catches SQL errors internally and reports them in its result.
      // Never remove the auth account unless the data wipe actually succeeded,
      // otherwise health data is orphaned with no owner able to access it.
      if (!data || data.success !== true) {
        console.error("[user-data-api] data deletion failed:", data?.error ?? "unknown");
        return json({
          error: "Data deletion failed — account NOT removed. Contact support.",
          detail: data?.error ?? null,
        }, 500);
      }

      const { error: adminErr } = await supabase.auth.admin.deleteUser(user.id);
      if (adminErr) {
        console.error("[user-data-api] auth deletion failed:", adminErr.message);
        return json({ ...data, auth_deleted: false, error: "Data wiped but auth account removal failed. Contact support." }, 500);
      }

      return json({ ...data, auth_deleted: true });
    }

    if (action === "consent_status") {
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

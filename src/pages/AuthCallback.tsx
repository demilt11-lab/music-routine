import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * AuthCallback — handles the OAuth redirect from Supabase after
 * Google / Apple sign-in. Supabase exchanges the token from the
 * URL hash/query, fires onAuthStateChange, and we navigate to /dashboard.
 */
const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase automatically picks up the token from the URL.
    // We just wait for the session to be established.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate("/dashboard", { replace: true });
      } else if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        navigate("/auth", { replace: true });
      }
    });

    // Fallback: if session is already set (e.g. fast exchange), navigate now
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/dashboard", { replace: true });
      }
    });

    // Safety timeout — if nothing happens in 10s, send to auth
    const timeout = setTimeout(() => {
      navigate("/auth", { replace: true });
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">Signing you in…</p>
    </div>
  );
};

export default AuthCallback;

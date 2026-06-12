import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks onboarding completion.
 * FIX BUG-005: Stores flag in Supabase profiles.onboarding_completed
 * instead of localStorage so it works in Capacitor native WebViews.
 * Falls back to localStorage for unauthenticated / guest previews.
 */
export function useOnboarding() {
  const [isComplete, setIsComplete]   = useState<boolean | null>(null); // null = loading
  const [isLoading, setIsLoading]     = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data, error } = await supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("id", user.id)
            .maybeSingle();

          if (!error && data) {
            setIsComplete(data.onboarding_completed ?? false);
            setIsLoading(false);
            return;
          }
        }

        // Unauthenticated fallback (pre-auth onboarding preview)
        try {
          const raw = typeof window !== "undefined"
            ? window.localStorage?.getItem("biomusic_onboarding_complete")
            : null;
          setIsComplete(raw === "true");
        } catch {
          setIsComplete(false);
        }
      } catch {
        setIsComplete(false);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const completeOnboarding = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ onboarding_completed: true })
          .eq("id", user.id);

        if (!error) {
          setIsComplete(true);
          return;
        }
        console.error("Failed to persist onboarding flag:", error);
      }

      // Fallback
      try {
        window.localStorage?.setItem("biomusic_onboarding_complete", "true");
      } catch { /* localStorage unavailable */ }
      setIsComplete(true);
    } catch {
      setIsComplete(true);
    }
  }, []);

  const resetOnboarding = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ onboarding_completed: false })
          .eq("id", user.id);
      }
      try {
        window.localStorage?.removeItem("biomusic_onboarding_complete");
      } catch { /* localStorage unavailable */ }
      setIsComplete(false);
    } catch {
      setIsComplete(false);
    }
  }, []);

  return { isComplete, isLoading, completeOnboarding, resetOnboarding };
}

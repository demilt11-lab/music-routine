import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Waits for the Supabase auth session to be restored from storage
 * before exposing the user. Prevents race conditions where queries
 * run before auth.uid() is available.
 *
 * FIX: The previous implementation called getSession() with .then()
 * and onAuthStateChange() separately. If the INITIAL_SESSION event
 * from onAuthStateChange fired before getSession() resolved, isReady
 * would never be set to true from the subscription path, causing a
 * flash redirect to /auth for already-logged-in users.
 *
 * The correct pattern is to rely solely on onAuthStateChange with the
 * INITIAL_SESSION event, which Supabase guarantees fires once on mount
 * with the restored session (or null). This is atomic and race-free.
 */
export function useAuthReady() {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;

    // onAuthStateChange fires INITIAL_SESSION synchronously with the
    // persisted session before any other event. This is the single
    // source of truth - no need for a separate getSession() call.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      // Always update the user from the session
      setUser(session?.user ?? null);

      // Mark ready on the first event (INITIAL_SESSION or SIGNED_IN/OUT)
      // INITIAL_SESSION is guaranteed to be the first event fired.
      if (!isReady) {
        setIsReady(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, isReady };
}

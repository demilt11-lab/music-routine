import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Waits for the Supabase auth session to be restored from storage
 * before exposing the user. Prevents race conditions where queries
 * run before auth.uid() is available.
 *
 * Uses a local `initialized` ref flag (not state) so it can never be
 * captured as a stale closure — fixing a bug where isReady could stay
 * false forever if the INITIAL_SESSION fired before the mounted guard.
 */
export function useAuthReady() {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;
    // Local flag — never captured as stale state, always reflects reality
    let initialized = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);

      // Mark ready exactly once, on the first event (INITIAL_SESSION)
      if (!initialized) {
        initialized = true;
        setIsReady(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
     
  }, []);

  return { user, isReady };
}

import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface HealthKitState {
  isAvailable: boolean;
  isAuthorized: boolean;
  isLoading: boolean;
  isPolling: boolean;
  lastHeartRate: number | null;
  lastReadAt: Date | null;
  error: string | null;
  platform: "ios" | "android" | "web";
}

interface UseHealthKitReturn {
  state: HealthKitState;
  requestAccess: () => Promise<boolean>;
  readLatestHeartRate: () => Promise<number | null>;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
}

function detectPlatform(): "ios" | "android" | "web" {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/Android/.test(ua)) {
    return "android";
  }
  return "web";
}

let Health: any = null;

async function loadHealthPlugin() {
  if (Health) return Health;
  try {
    const mod = await import("@capgo/capacitor-health");
    Health = mod.Health;
    return Health;
  } catch {
    return null;
  }
}

export function useHealthKit(): UseHealthKitReturn {
  const platform = detectPlatform();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartRateCallbackRef = useRef<((hr: number) => void) | null>(null);

  const [state, setState] = useState<HealthKitState>({
    isAvailable: false,
    isAuthorized: false,
    isLoading: false,
    isPolling: false,
    lastHeartRate: null,
    lastReadAt: null,
    error: null,
    platform,
  });

  // Check availability on mount
  useEffect(() => {
    (async () => {
      const plugin = await loadHealthPlugin();
      if (!plugin) return;
      try {
        const { available } = await plugin.isAvailable();
        setState((prev) => ({ ...prev, isAvailable: available }));
      } catch {
        // Not available (web context)
      }
    })();
  }, []);

  const requestAccess = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const plugin = await loadHealthPlugin();
      if (!plugin) throw new Error("Health plugin not available");

      const { available } = await plugin.isAvailable();
      if (!available) {
        throw new Error("HealthKit is not available on this device");
      }

      await plugin.requestAuthorization({
        read: ["heartRate"],
        write: [],
      });

      setState((prev) => ({
        ...prev,
        isAvailable: true,
        isAuthorized: true,
        isLoading: false,
      }));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authorization failed";
      setState((prev) => ({ ...prev, isLoading: false, error: msg }));
      return false;
    }
  }, []);

  const readLatestHeartRate = useCallback(async (): Promise<number | null> => {
    try {
      const plugin = await loadHealthPlugin();
      if (!plugin) return null;

      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const { samples } = await plugin.readSamples({
        dataType: "heartRate",
        startDate: fiveMinAgo.toISOString(),
        endDate: now.toISOString(),
        limit: 1,
      });

      if (samples && samples.length > 0) {
        const bpm = Math.round(samples[0].value);
        setState((prev) => ({
          ...prev,
          lastHeartRate: bpm,
          lastReadAt: new Date(),
          error: null,
        }));

        // Save to database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("biometric_readings").insert({
            user_id: user.id,
            heart_rate: bpm,
            device_type: platform === "ios" ? "apple_healthkit" : "health_connect",
            recorded_at: new Date().toISOString(),
          });
        }

        heartRateCallbackRef.current?.(bpm);
        return bpm;
      }

      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to read heart rate";
      setState((prev) => ({ ...prev, error: msg }));
      return null;
    }
  }, [platform]);

  const startPolling = useCallback(
    (intervalMs = 10000) => {
      if (pollingRef.current) return;

      // Read immediately
      readLatestHeartRate();

      pollingRef.current = setInterval(() => {
        readLatestHeartRate();
      }, intervalMs);

      setState((prev) => ({ ...prev, isPolling: true }));
    },
    [readLatestHeartRate]
  );

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setState((prev) => ({ ...prev, isPolling: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  return { state, requestAccess, readLatestHeartRate, startPolling, stopPolling };
}

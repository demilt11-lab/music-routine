import { useEffect, useRef } from "react";
import { toast } from "sonner";

const DEBOUNCE_MS = 4000;
const FETCH_TIMEOUT_MS = 5000;
const GRACE_PERIOD_MS = 6000;

/** Perform a real connectivity test using multiple fallback URLs. */
async function testConnectivity(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }

  const urls = [
    `/manifest.json?_=${Date.now()}`,
    `https://www.google.com/favicon.ico`,
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      await fetch(url, { mode: "no-cors", cache: "no-store", signal: controller.signal });
      clearTimeout(timer);
      return true;
    } catch {
      // Try next URL
    }
  }
  return false;
}

const isPreviewEnv = typeof window !== "undefined" && (() => {
  const host = window.location.hostname;
  return host === "localhost" || host.includes("lovableproject.com") || host.includes("lovable.app") || host.startsWith("id-preview--");
})();

/**
 * Lightweight connectivity monitor that uses non-blocking sonner toasts
 * instead of a prominent fixed banner. Renders nothing to the DOM.
 */
export function ConnectionStatusBanner() {
  const mountTime = useRef(Date.now());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOffline = useRef(false);
  const hasPassedGrace = useRef(false);
  const offlineToastId = useRef<string | number | undefined>(undefined);

  const runConnectivityCheck = async (source: "event" | "manual") => {
    if (isPreviewEnv) return;
    const elapsed = Date.now() - mountTime.current;
    if (elapsed < GRACE_PERIOD_MS && source !== "manual") return;
    hasPassedGrace.current = true;

    const online = await testConnectivity();

    if (!online && hasPassedGrace.current) {
      wasOffline.current = true;
      // Show a dismissible, non-blocking toast (only one at a time)
      if (!offlineToastId.current) {
        offlineToastId.current = toast.warning(
          "You appear to be offline — some features may be unavailable.",
          { duration: Infinity, dismissible: true, id: "offline-status" }
        );
      }
    } else {
      // Dismiss offline toast if it was showing
      if (offlineToastId.current) {
        toast.dismiss(offlineToastId.current);
        offlineToastId.current = undefined;
      }
      if (wasOffline.current) {
        toast.success("Back online", { description: "Your connection has been restored.", duration: 3000 });
        wasOffline.current = false;
      }
    }
  };

  useEffect(() => {
    if (isPreviewEnv) return;

    const goOffline = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        runConnectivityCheck("event");
      }, DEBOUNCE_MS);
    };

    const goOnline = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      runConnectivityCheck("event");
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This component renders nothing — all UI is via sonner toasts
  return null;
}

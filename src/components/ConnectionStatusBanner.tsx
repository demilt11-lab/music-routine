import { useState, useEffect, useRef, forwardRef } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const DEBOUNCE_MS = 4000;
const FETCH_TIMEOUT_MS = 5000;
const GRACE_PERIOD_MS = 6000;

/** Perform a real connectivity test using multiple fallback URLs. */
async function testConnectivity(): Promise<boolean> {
  // If navigator.onLine is false, that's a strong signal
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }

  const urls = [
    `/manifest.json?_=${Date.now()}`, // Same-origin — works in iframes
    `https://www.google.com/favicon.ico`,
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      await fetch(url, { mode: "no-cors", cache: "no-store", signal: controller.signal });
      clearTimeout(timer);
      return true; // Any success = online
    } catch {
      // Try next URL
    }
  }
  return false;
}

const isPreviewEnv = typeof window !== "undefined" && (window.location.hostname.includes("lovableproject.com") || window.location.hostname === "localhost");

export const ConnectionStatusBanner = forwardRef<HTMLDivElement>((_, ref) => {
  const [isOffline, setIsOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const mountTime = useRef(Date.now());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOffline = useRef(false);
  const hasPassedGrace = useRef(false);

  // In preview/dev environments, never show the offline banner
  if (isPreviewEnv) return null;

  const runConnectivityCheck = async (source: "event" | "manual") => {
    const elapsed = Date.now() - mountTime.current;

    // Never show offline during the grace period (unless manually triggered)
    if (elapsed < GRACE_PERIOD_MS && source !== "manual") {
      return;
    }
    hasPassedGrace.current = true;

    setChecking(true);
    const online = await testConnectivity();
    setChecking(false);

    if (!online && hasPassedGrace.current) {
      setIsOffline(true);
      wasOffline.current = true;
    } else {
      setIsOffline(false);
      if (wasOffline.current) {
        toast({ title: "Back online", description: "Your connection has been restored.", duration: 3000 });
        wasOffline.current = false;
      }
    }
  };

  useEffect(() => {
    const goOffline = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        runConnectivityCheck("event");
      }, DEBOUNCE_MS);
    };

    const goOnline = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      // Quick check to dismiss the banner
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

  if (!isOffline) return null;

  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 right-0 z-[60] bg-destructive text-destructive-foreground text-center text-sm font-medium py-2 px-4 flex items-center justify-center gap-2 animate-in slide-in-from-top"
    >
      <WifiOff className="w-4 h-4" />
      You're offline — some features may be unavailable
      <Button
        size="sm"
        variant="secondary"
        className="ml-2 h-7 text-xs"
        disabled={checking}
        onClick={() => runConnectivityCheck("manual")}
      >
        <RefreshCw className={`w-3 h-3 mr-1 ${checking ? "animate-spin" : ""}`} />
        Try Again
      </Button>
    </div>
  );
});

ConnectionStatusBanner.displayName = "ConnectionStatusBanner";

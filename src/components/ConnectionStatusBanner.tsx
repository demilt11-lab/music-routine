import { useState, useEffect, useRef, forwardRef } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const DEBOUNCE_MS = 3000;
const FETCH_TIMEOUT_MS = 5000;

/** Perform a real connectivity test — resolves true if the network is reachable. */
async function testConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    await fetch("https://www.google.com/favicon.ico", {
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

export const ConnectionStatusBanner = forwardRef<HTMLDivElement>((_, ref) => {
  // Default to ONLINE — never show offline on first render
  const [isOffline, setIsOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const mountTime = useRef(Date.now());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOffline = useRef(false);

  const runConnectivityCheck = async (source: "event" | "manual") => {
    // Never show offline within first 3 seconds of app life
    if (Date.now() - mountTime.current < DEBOUNCE_MS && source !== "manual") return;

    setChecking(true);
    const online = await testConnectivity();
    setChecking(false);

    if (!online) {
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
      // Debounce: wait 3s before actually testing
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

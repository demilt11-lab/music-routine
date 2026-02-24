import { useState, useEffect, useRef, useCallback } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function ConnectionStatusBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const wasOffline = useRef(false);

  const checkOnline = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOffline(true);
      wasOffline.current = true;
      return;
    }
    try {
      await fetch("/favicon.ico", { method: "HEAD", cache: "no-store" });
      setIsOffline(false);
      if (wasOffline.current) {
        toast({ title: "Back online", description: "Your connection has been restored.", duration: 3000 });
        wasOffline.current = false;
      }
    } catch {
      setIsOffline(true);
      wasOffline.current = true;
    }
  }, []);

  useEffect(() => {
    checkOnline();

    const goOffline = () => {
      setIsOffline(true);
      wasOffline.current = true;
    };
    const goOnline = () => checkOnline();

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [checkOnline]);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-destructive text-destructive-foreground text-center text-sm font-medium py-2 px-4 flex items-center justify-center gap-2 animate-in slide-in-from-top">
      <WifiOff className="w-4 h-4" />
      You're offline — some features may be unavailable
    </div>
  );
}

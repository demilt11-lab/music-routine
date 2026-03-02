import { useState, useEffect, forwardRef } from "react";
import { X, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "biomusic_ios_install_dismissed";

export const IOSInstallPrompt = forwardRef<HTMLDivElement>((_, ref) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    const dismissed = localStorage.getItem(DISMISSED_KEY);

    if (isIOS && !isStandalone && !dismissed) {
      setShow(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div ref={ref} className="fixed bottom-20 left-4 right-4 z-[60] md:hidden animate-in slide-in-from-bottom-4">
      <div className="glass rounded-2xl border border-border/50 p-4 shadow-lg">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-sm">Install BioMusic</h3>
          <button onClick={dismiss} className="p-1 touch-manipulation" aria-label="Dismiss">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
              <Share className="w-4 h-4 text-primary" />
            </div>
            <span>Tap the <strong className="text-foreground">Share</strong> button in Safari</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <span>Then tap <strong className="text-foreground">Add to Home Screen</strong></span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full mt-3 touch-manipulation" onClick={dismiss}>
          Maybe later
        </Button>
      </div>
    </div>
  );
});

IOSInstallPrompt.displayName = "IOSInstallPrompt";

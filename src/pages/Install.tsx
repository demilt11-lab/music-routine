import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Check, Smartphone, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => setInstalled(true));

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <img src="/app-icon.png" alt="BioMusic" className="w-20 h-20 mx-auto rounded-2xl mb-4" />
          <CardTitle className="text-2xl">Install BioMusic</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {installed ? (
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-accent" />
              </div>
              <p className="text-muted-foreground">BioMusic is installed! Open it from your home screen.</p>
              <Button onClick={() => navigate("/")} className="w-full">Go to App</Button>
            </div>
          ) : deferredPrompt ? (
            <div className="space-y-4">
              <p className="text-muted-foreground text-center">
                Install BioMusic for a faster, app-like experience with offline support.
              </p>
              <Button onClick={handleInstall} className="w-full gradient-primary" size="lg">
                <Download className="w-5 h-5 mr-2" /> Install App
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground text-center text-sm">
                To install BioMusic on your device:
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                  <Smartphone className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">iPhone / iPad</p>
                    <p className="text-xs text-muted-foreground">Tap Share → "Add to Home Screen"</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                  <Smartphone className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Android</p>
                    <p className="text-xs text-muted-foreground">Tap the browser menu → "Install app"</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                  <Monitor className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Desktop</p>
                    <p className="text-xs text-muted-foreground">Click the install icon in the address bar</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <Button variant="ghost" onClick={() => navigate("/")} className="w-full">
            Back to App
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

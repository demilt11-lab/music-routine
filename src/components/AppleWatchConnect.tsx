import { useAppleWatchBluetooth } from "@/hooks/useAppleWatchBluetooth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Bluetooth, BluetoothOff, Smartphone, AlertTriangle } from "lucide-react";

export function AppleWatchConnect() {
  const {
    isSupported,
    isIOSSafari,
    isConnected,
    isConnecting,
    heartRate,
    deviceName,
    error,
    connect,
    disconnect,
  } = useAppleWatchBluetooth();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Heart Rate Monitor
            </CardTitle>
            <CardDescription>
              Connect your Apple Watch or Bluetooth HR strap
            </CardDescription>
          </div>
          {isConnected && (
            <Badge variant="default" className="bg-primary text-primary-foreground">
              <span className="w-2 h-2 bg-white rounded-full mr-1.5 animate-pulse" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* iOS Safari fallback */}
        {isIOSSafari && (
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="w-4 h-4 text-primary" />
              iOS Detected — Use Apple Health Instead
            </div>
            <p className="text-xs text-muted-foreground">
              Web Bluetooth is not supported on iOS Safari. To get heart rate data from your Apple Watch:
            </p>
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
              <li>Open the <strong>Health</strong> app on your iPhone</li>
              <li>Go to <strong>Sharing</strong> → enable heart rate data sharing</li>
              <li>Install the BioMusic iOS app to sync automatically</li>
            </ol>
          </div>
        )}

        {/* Web Bluetooth not supported (non-iOS) */}
        {!isSupported && !isIOSSafari && (
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <BluetoothOff className="w-4 h-4" />
              Bluetooth Not Available
            </div>
            <p className="text-xs text-muted-foreground">
              Your browser doesn't support Web Bluetooth. Try using Chrome on desktop or Android.
            </p>
          </div>
        )}

        {/* Connectable state */}
        {isSupported && !isIOSSafari && !isConnected && (
          <Button
            onClick={connect}
            disabled={isConnecting}
            className="w-full"
          >
            <Bluetooth className="w-4 h-4 mr-2" />
            {isConnecting ? "Scanning for devices…" : "Connect via Bluetooth"}
          </Button>
        )}

        {/* Connected state */}
        {isConnected && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{deviceName}</p>
                <p className="text-xs text-muted-foreground">Heart Rate Service</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary tabular-nums">
                  {heartRate ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">BPM</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={disconnect} className="w-full">
              Disconnect
            </Button>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

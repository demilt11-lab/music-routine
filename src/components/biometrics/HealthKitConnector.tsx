import { Heart, Smartphone, RefreshCw, Play, Square, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useHealthKit } from "@/hooks/useHealthKit";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface HealthKitConnectorProps {
  onHeartRateUpdate?: (heartRate: number) => void;
}

export function HealthKitConnector({ onHeartRateUpdate }: HealthKitConnectorProps) {
  const { state, requestAccess, readLatestHeartRate, startPolling, stopPolling } = useHealthKit();

  // Forward heart rate updates
  useEffect(() => {
    if (state.lastHeartRate && onHeartRateUpdate) {
      onHeartRateUpdate(state.lastHeartRate);
    }
  }, [state.lastHeartRate, onHeartRateUpdate]);

  if (state.platform === "web") {
    return null; // Don't render on web — Bluetooth connector handles that
  }

  const platformLabel = state.platform === "ios" ? "Apple Health" : "Health Connect";
  const platformIcon = state.platform === "ios" ? "🍎" : "🤖";

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Smartphone className="w-5 h-5 text-primary" />
          {platformLabel}
        </CardTitle>
        <CardDescription>
          {state.platform === "ios"
            ? "Read heart rate from Apple Watch via HealthKit"
            : "Read heart rate from wearables via Health Connect"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {!state.isAvailable ? (
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              {platformLabel} is not available. Make sure you're running the native app (not a web browser) and {state.platform === "ios" ? "HealthKit" : "Health Connect"} is set up on your device.
            </AlertDescription>
          </Alert>
        ) : !state.isAuthorized ? (
          <div className="text-center p-6 rounded-lg border-2 border-dashed border-muted-foreground/25">
            <div className="text-4xl mb-3">{platformIcon}</div>
            <h3 className="font-medium mb-1">Connect {platformLabel}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Allow BioMusic to read your heart rate data from {state.platform === "ios" ? "Apple Watch" : "your wearable"}
            </p>
            <Button
              onClick={requestAccess}
              disabled={state.isLoading}
              className="touch-manipulation min-h-[44px]"
            >
              {state.isLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Heart className="w-4 h-4 mr-2" />
              )}
              Grant Access
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">{platformLabel}</p>
                  <Badge variant="secondary" className="bg-green-500/20 text-green-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />
                    Authorized
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={readLatestHeartRate}
                  className="touch-manipulation min-h-[44px]"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button
                  variant={state.isPolling ? "destructive" : "default"}
                  size="sm"
                  onClick={() => (state.isPolling ? stopPolling() : startPolling(10000))}
                  className="touch-manipulation min-h-[44px]"
                >
                  {state.isPolling ? (
                    <>
                      <Square className="w-4 h-4 mr-1" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-1" />
                      Auto-Read
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Heart rate display */}
            {state.lastHeartRate !== null && (
              <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-muted/50">
                <Heart className={cn("w-6 h-6 text-red-500", state.isPolling && "animate-pulse")} />
                <div>
                  <span className="text-3xl font-bold tabular-nums">{state.lastHeartRate}</span>
                  <span className="text-sm text-muted-foreground ml-1">bpm</span>
                </div>
                {state.lastReadAt && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {state.lastReadAt.toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}

            {state.isPolling && (
              <p className="text-xs text-muted-foreground text-center">
                Reading heart rate every 10 seconds from {state.platform === "ios" ? "Apple Watch" : "wearable"}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

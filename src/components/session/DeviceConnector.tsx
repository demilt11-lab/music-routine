import { Watch, Bluetooth, BluetoothOff, Battery, Heart, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWebBluetooth } from "@/hooks/useWebBluetooth";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface DeviceConnectorProps {
  onHeartRateUpdate?: (heartRate: number) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function DeviceConnector({ onHeartRateUpdate, onConnectionChange }: DeviceConnectorProps) {
  const { state, scanForDevices, disconnect, onHeartRateChange } = useWebBluetooth();

  useEffect(() => {
    if (onHeartRateUpdate) {
      onHeartRateChange(onHeartRateUpdate);
    }
  }, [onHeartRateUpdate, onHeartRateChange]);

  useEffect(() => {
    onConnectionChange?.(state.isConnected);
  }, [state.isConnected, onConnectionChange]);

  const deviceIcons: Record<string, React.ReactNode> = {
    "Polar": <Watch className="w-5 h-5" />,
    "Wahoo": <Heart className="w-5 h-5" />,
    "Garmin": <Watch className="w-5 h-5" />,
    "Fitbit": <Watch className="w-5 h-5" />,
    "Apple": <Watch className="w-5 h-5" />,
    "default": <Bluetooth className="w-5 h-5" />,
  };

  const getDeviceIcon = (name: string) => {
    for (const [prefix, icon] of Object.entries(deviceIcons)) {
      if (name.includes(prefix)) return icon;
    }
    return deviceIcons.default;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bluetooth className="w-5 h-5 text-primary" />
          Wearable Device
        </CardTitle>
        <CardDescription>
          Connect your heart rate monitor for live biometric tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!state.isSupported && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Web Bluetooth is not supported in this browser. Try Chrome, Edge, or Opera on desktop.
            </AlertDescription>
          </Alert>
        )}

        {state.error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {state.isConnected && state.device ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {getDeviceIcon(state.device.name)}
                </div>
                <div>
                  <p className="font-medium">{state.device.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="bg-green-500/20 text-green-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />
                      Connected
                    </Badge>
                    {state.device.batteryLevel !== undefined && (
                      <span className="flex items-center gap-1">
                        <Battery className="w-3 h-3" />
                        {state.device.batteryLevel}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={disconnect}>
                <BluetoothOff className="w-4 h-4 mr-1" />
                Disconnect
              </Button>
            </div>

            {state.lastHeartRate !== null && (
              <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-muted/50">
                <Heart className="w-6 h-6 text-red-500 animate-pulse" />
                <div>
                  <span className="text-3xl font-bold tabular-nums">{state.lastHeartRate}</span>
                  <span className="text-sm text-muted-foreground ml-1">bpm</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center p-6 rounded-lg border-2 border-dashed border-muted-foreground/25">
              <div className={cn(
                "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center",
                state.isScanning ? "bg-primary/20" : "bg-muted"
              )}>
                {state.isScanning ? (
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                ) : (
                  <Watch className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <h3 className="font-medium mb-1">
                {state.isScanning ? "Scanning for devices..." : "No Device Connected"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {state.isScanning
                  ? "Select your device from the browser popup"
                  : "Connect a Bluetooth heart rate monitor for live tracking"}
              </p>
              <Button
                onClick={scanForDevices}
                disabled={state.isScanning || !state.isSupported}
              >
                {state.isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-4 h-4 mr-2" />
                    Connect Device
                  </>
                )}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Supported devices:</p>
              <ul className="grid grid-cols-2 gap-1 text-xs">
                <li className="flex items-center gap-1"><Watch className="w-3 h-3" /> Apple Watch</li>
                <li className="flex items-center gap-1"><Watch className="w-3 h-3" /> Garmin</li>
                <li className="flex items-center gap-1"><Watch className="w-3 h-3" /> Fitbit</li>
                <li className="flex items-center gap-1"><Heart className="w-3 h-3" /> Polar HR</li>
                <li className="flex items-center gap-1"><Heart className="w-3 h-3" /> Wahoo TICKR</li>
                <li className="flex items-center gap-1"><Watch className="w-3 h-3" /> Any BLE HR</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

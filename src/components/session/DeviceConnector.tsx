import { Watch, Bluetooth, BluetoothOff, Battery, Heart, Loader2, AlertCircle, Info, Smartphone, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWebBluetooth } from "@/hooks/useWebBluetooth";
import { useBluetoothPermission } from "@/hooks/useBluetoothPermission";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { HealthKitConnector } from "@/components/biometrics/HealthKitConnector";
import { BluetoothSetupGuide } from "@/components/session/BluetoothSetupGuide";

interface DeviceConnectorProps {
  onHeartRateUpdate?: (heartRate: number, hrv?: { rmssd: number; sdnn: number }) => void;
  onConnectionChange?: (connected: boolean) => void;
}

function getPlatformInfo() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  return { isIOS, isAndroid, isNative, isDesktop: !isIOS && !isAndroid };
}

function ConnectionStatusBadge({ state }: { state: { isScanning: boolean; isConnected: boolean; isReconnecting: boolean; isSupported: boolean; device: any } }) {
  if (state.isReconnecting) {
    return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Reconnecting...</Badge>;
  }
  if (state.isConnected && state.device) {
    return <Badge variant="secondary" className="bg-green-500/20 text-green-600"><div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />Connected to {state.device.name}</Badge>;
  }
  if (state.isScanning) {
    return <Badge variant="secondary" className="bg-blue-500/20 text-blue-600"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Scanning...</Badge>;
  }
  if (!state.isSupported) {
    return <Badge variant="secondary" className="bg-muted text-muted-foreground">Not supported</Badge>;
  }
  return <Badge variant="secondary" className="bg-muted text-muted-foreground">Disconnected</Badge>;
}

export function DeviceConnector({ onHeartRateUpdate, onConnectionChange }: DeviceConnectorProps) {
  const { state, scanForDevices, disconnect, onHeartRateChange } = useWebBluetooth();
  const { permissionState, requestPermission } = useBluetoothPermission();
  const platform = getPlatformInfo();

  useEffect(() => {
    if (onHeartRateUpdate) onHeartRateChange(onHeartRateUpdate);
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

  const renderUnsupportedContent = () => {
    // iOS web/Safari
    if (platform.isIOS && !platform.isNative) {
      return (
        <div className="space-y-3">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{state.unsupportedReason}</AlertDescription>
          </Alert>
          <div className="grid gap-3">
            <div className="p-3 rounded-lg border bg-primary/5">
              <p className="text-sm font-medium flex items-center gap-2"><Smartphone className="w-4 h-4 text-primary" /> Download BioMusic app</p>
              <p className="text-xs text-muted-foreground mt-1">Auto-read heart rate from Apple Watch via HealthKit</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-sm font-medium flex items-center gap-2"><Heart className="w-4 h-4 text-primary" /> Manual Entry</p>
              <p className="text-xs text-muted-foreground mt-1">Log heart rate readings from the Apple Health app</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-sm font-medium flex items-center gap-2"><Watch className="w-4 h-4 text-primary" /> watchOS HR Broadcast</p>
              <p className="text-xs text-muted-foreground mt-1">Use a watchOS app like Heart Analyzer that broadcasts HR via BLE, then connect from a Chrome desktop browser</p>
            </div>
          </div>
        </div>
      );
    }

    // Generic unsupported
    return (
      <Alert>
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>
          {state.unsupportedReason || "Web Bluetooth is not supported in this browser. Try Chrome, Edge, or Opera on desktop."}
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="space-y-4">
      <HealthKitConnector onHeartRateUpdate={onHeartRateUpdate} />

      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bluetooth className="w-5 h-5 text-primary" />
            Wearable Device
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[250px]">
                  <p className="text-xs">Web Bluetooth is supported on Chrome, Edge, and Opera (desktop &amp; Android). Not available on iOS Safari or Firefox.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <div className="flex items-center gap-2">
            <CardDescription>Connect your heart rate monitor</CardDescription>
            <ConnectionStatusBadge state={state} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!state.isSupported && renderUnsupportedContent()}

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {/* Android Chrome permission gate */}
          {state.isSupported && permissionState === "denied" && platform.isAndroid && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Bluetooth permission was denied. Please grant Bluetooth permission in your browser settings, then tap below.
              </AlertDescription>
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
                      <ConnectionStatusBadge state={state} />
                      {state.device.batteryLevel !== undefined && (
                        <span className="flex items-center gap-1"><Battery className="w-3 h-3" />{state.device.batteryLevel}%</span>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={disconnect}>
                  <BluetoothOff className="w-4 h-4 mr-1" />Disconnect
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
          ) : state.isSupported ? (
            <div className="space-y-4">
              <div className="text-center p-6 rounded-lg border-2 border-dashed border-muted-foreground/25">
                <div className={cn(
                  "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center",
                  state.isScanning || state.isReconnecting ? "bg-primary/20" : "bg-muted"
                )}>
                  {state.isScanning || state.isReconnecting ? (
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  ) : (
                    <Watch className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <h3 className="font-medium mb-1">
                  {state.isReconnecting ? "Reconnecting..." : state.isScanning ? "Scanning for devices..." : "No Device Connected"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {state.isScanning
                    ? "Select your device from the browser popup"
                    : state.isReconnecting
                      ? "Attempting to reconnect to your device..."
                      : "Connect a Bluetooth heart rate monitor for live tracking"}
                </p>
                <Button onClick={scanForDevices} disabled={state.isScanning || state.isReconnecting}>
                  {state.isScanning ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning...</>
                  ) : (
                    <><Bluetooth className="w-4 h-4 mr-2" />Connect Device</>
                  )}
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">Compatible devices:</p>
                <ul className="grid grid-cols-2 gap-1 text-xs">
                  <li className="flex items-center gap-1"><Watch className="w-3 h-3" /> Apple Watch (HR Broadcast)</li>
                  <li className="flex items-center gap-1"><Watch className="w-3 h-3" /> Garmin</li>
                  <li className="flex items-center gap-1"><Watch className="w-3 h-3" /> Fitbit</li>
                  <li className="flex items-center gap-1"><Heart className="w-3 h-3" /> Polar HR</li>
                  <li className="flex items-center gap-1"><Heart className="w-3 h-3" /> Wahoo TICKR</li>
                  <li className="flex items-center gap-1"><Bluetooth className="w-3 h-3" /> Any BLE HR Monitor</li>
                </ul>
              </div>

              <BluetoothSetupGuide />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

import { Brain, Bluetooth, BluetoothOff, Battery, Loader2, AlertCircle, Waves, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useMuseEEG, EEGReading } from "@/hooks/useMuseEEG";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface EEGConnectorProps {
  onEEGUpdate?: (reading: EEGReading, metrics: { focus: number; relaxation: number; meditation: number }) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function EEGConnector({ onEEGUpdate, onConnectionChange }: EEGConnectorProps) {
  const { state, scanForMuse, disconnect, onEEGUpdate: setEEGCallback } = useMuseEEG();

  useEffect(() => {
    if (onEEGUpdate) {
      setEEGCallback((reading) => {
        onEEGUpdate(reading, {
          focus: state.focusScore,
          relaxation: state.relaxationScore,
          meditation: state.meditationScore,
        });
      });
    }
  }, [onEEGUpdate, setEEGCallback, state.focusScore, state.relaxationScore, state.meditationScore]);

  useEffect(() => {
    onConnectionChange?.(state.isConnected);
  }, [state.isConnected, onConnectionChange]);

  const getBandLabel = (value: number, band: string): { label: string; color: string } => {
    const ranges: Record<string, { low: number; high: number }> = {
      delta: { low: 1, high: 4 },
      theta: { low: 4, high: 8 },
      alpha: { low: 8, high: 12 },
      beta: { low: 12, high: 30 },
      gamma: { low: 30, high: 50 },
    };

    const range = ranges[band];
    if (!range) return { label: "Unknown", color: "text-muted-foreground" };

    if (value < range.low) return { label: "Low", color: "text-yellow-500" };
    if (value > range.high) return { label: "High", color: "text-green-500" };
    return { label: "Normal", color: "text-blue-500" };
  };

  const formatBandPower = (value: number): string => {
    return value.toFixed(1);
  };

  return (
    <Card className="border-purple-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="w-5 h-5 text-purple-500" />
          EEG Headband
        </CardTitle>
        <CardDescription>
          Connect your Muse headband for brainwave-based recommendations
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
            <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-purple-500" />
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

            {/* Cognitive Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Activity className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                <div className="text-2xl font-bold tabular-nums">{state.focusScore}</div>
                <div className="text-xs text-muted-foreground">Focus</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Waves className="w-5 h-5 mx-auto mb-1 text-green-500" />
                <div className="text-2xl font-bold tabular-nums">{state.relaxationScore}</div>
                <div className="text-xs text-muted-foreground">Relaxation</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Brain className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                <div className="text-2xl font-bold tabular-nums">{state.meditationScore}</div>
                <div className="text-xs text-muted-foreground">Meditation</div>
              </div>
            </div>

            {/* Brainwave Bands */}
            {state.currentReading && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Brainwave Activity</p>
                
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-purple-400">Delta (0.5-4 Hz)</span>
                    <span className="tabular-nums">{formatBandPower(state.currentReading.delta)} µV</span>
                  </div>
                  <Progress value={Math.min(100, state.currentReading.delta * 20)} className="h-1.5 bg-purple-900/20 [&>div]:bg-purple-400" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-400">Theta (4-8 Hz)</span>
                    <span className="tabular-nums">{formatBandPower(state.currentReading.theta)} µV</span>
                  </div>
                  <Progress value={Math.min(100, state.currentReading.theta * 10)} className="h-1.5 bg-blue-900/20 [&>div]:bg-blue-400" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-green-400">Alpha (8-12 Hz)</span>
                    <span className="tabular-nums">{formatBandPower(state.currentReading.alpha)} µV</span>
                  </div>
                  <Progress value={Math.min(100, state.currentReading.alpha * 8)} className="h-1.5 bg-green-900/20 [&>div]:bg-green-400" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-yellow-400">Beta (12-30 Hz)</span>
                    <span className="tabular-nums">{formatBandPower(state.currentReading.beta)} µV</span>
                  </div>
                  <Progress value={Math.min(100, state.currentReading.beta * 3)} className="h-1.5 bg-yellow-900/20 [&>div]:bg-yellow-400" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-red-400">Gamma (30-50 Hz)</span>
                    <span className="tabular-nums">{formatBandPower(state.currentReading.gamma)} µV</span>
                  </div>
                  <Progress value={Math.min(100, state.currentReading.gamma * 2)} className="h-1.5 bg-red-900/20 [&>div]:bg-red-400" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center p-6 rounded-lg border-2 border-dashed border-muted-foreground/25">
              <div className={cn(
                "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center",
                state.isScanning ? "bg-purple-500/20" : "bg-muted"
              )}>
                {state.isScanning ? (
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                ) : (
                  <Brain className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <h3 className="font-medium mb-1">
                {state.isScanning ? "Scanning for Muse..." : "No EEG Headband Connected"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {state.isScanning
                  ? "Select your Muse device from the browser popup"
                  : "Connect a Muse EEG headband for brainwave-based recommendations"}
              </p>
              <Button
                onClick={scanForMuse}
                disabled={state.isScanning || !state.isSupported}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {state.isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-4 h-4 mr-2" />
                    Connect Muse
                  </>
                )}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Supported devices:</p>
              <ul className="grid grid-cols-2 gap-1 text-xs">
                <li className="flex items-center gap-1"><Brain className="w-3 h-3" /> Muse 2</li>
                <li className="flex items-center gap-1"><Brain className="w-3 h-3" /> Muse S</li>
                <li className="flex items-center gap-1"><Brain className="w-3 h-3" /> Muse S (Gen 2)</li>
                <li className="flex items-center gap-1"><Brain className="w-3 h-3" /> Muse 2016</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

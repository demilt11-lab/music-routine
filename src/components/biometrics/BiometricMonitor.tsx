import { forwardRef } from "react";
import { Heart, Activity, Brain, TrendingUp, Waves, Play, Square } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useBiometricTracking } from "@/hooks/useBiometricTracking";
import { cn } from "@/lib/utils";
import { ManualHeartRateInput } from "./ManualHeartRateInput";
import { HealthKitConnector } from "./HealthKitConnector";

interface BiometricMonitorProps {
  onFlowStateChange?: (flowState: string) => void;
  songEnergy?: number;
  songTempo?: number;
}

export const BiometricMonitor = forwardRef<HTMLDivElement, BiometricMonitorProps>(({ onFlowStateChange, songEnergy, songTempo }, ref) => {
  const { state, startTracking, stopTracking, simulateBiometrics } = useBiometricTracking();
  
  const flowStateColors = {
    "none": "bg-muted text-muted-foreground",
    "entering": "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    "in-flow": "bg-green-500/20 text-green-600 dark:text-green-400",
    "exiting": "bg-orange-500/20 text-orange-600 dark:text-orange-400",
  };

  const flowStateLabels = {
    "none": "Not in Flow",
    "entering": "Entering Flow",
    "in-flow": "In Flow State 🎯",
    "exiting": "Exiting Flow",
  };

  const handleToggleTracking = () => {
    if (state.isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  // Simulate with current song's characteristics
  const handleSimulate = () => {
    simulateBiometrics(songEnergy, songTempo);
  };

  const getHeartRateZone = (hr: number) => {
    if (hr < 60) return { label: "Resting", color: "text-blue-500" };
    if (hr < 80) return { label: "Light", color: "text-green-500" };
    if (hr < 100) return { label: "Moderate", color: "text-yellow-500" };
    if (hr < 140) return { label: "Hard", color: "text-orange-500" };
    return { label: "Maximum", color: "text-red-500" };
  };

  const currentHr = state.currentReading?.heartRate || 0;
  const hrZone = getHeartRateZone(currentHr);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Waves className="w-5 h-5 text-primary" />
              Biometric Monitor
            </CardTitle>
            <CardDescription>
              Real-time tracking of your physiological state
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn("transition-colors", flowStateColors[state.flowState])}>
              {flowStateLabels[state.flowState]}
            </Badge>
            <Button
              variant={state.isTracking ? "destructive" : "default"}
              size="sm"
              onClick={handleToggleTracking}
            >
              {state.isTracking ? (
                <>
                  <Square className="w-4 h-4 mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Start
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Heart Rate */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Heart className={cn("w-4 h-4", state.isTracking && "animate-pulse text-red-500")} />
              Heart Rate
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums">
                {currentHr || "--"}
              </span>
              <span className="text-sm text-muted-foreground">bpm</span>
            </div>
            <span className={cn("text-xs", hrZone.color)}>{hrZone.label} Zone</span>
          </div>

          {/* Stress Level */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity className="w-4 h-4 text-orange-500" />
              Stress Level
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums">
                {state.currentReading?.stressLevel ?? "--"}
              </span>
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <Progress 
              value={state.currentReading?.stressLevel || 0} 
              className="h-2"
            />
          </div>

          {/* Focus Score */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Brain className="w-4 h-4 text-purple-500" />
              Focus Score
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums">
                {state.currentReading?.focusScore ?? "--"}
              </span>
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <Progress 
              value={state.currentReading?.focusScore || 0} 
              className="h-2 [&>div]:bg-purple-500"
            />
          </div>

          {/* Relaxation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Relaxation
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums">
                {state.currentReading?.relaxationScore ?? "--"}
              </span>
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <Progress 
              value={state.currentReading?.relaxationScore || 0} 
              className="h-2 [&>div]:bg-green-500"
            />
          </div>
        </div>

        {/* Session Averages */}
        {state.readings.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-2">Session Averages ({state.readings.length} readings)</p>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Avg HR:</span>{" "}
                <span className="font-medium">{state.averages.heartRate} bpm</span>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Stress:</span>{" "}
                <span className="font-medium">{state.averages.stressLevel}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Focus:</span>{" "}
                <span className="font-medium">{state.averages.focusScore}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Relaxation:</span>{" "}
                <span className="font-medium">{state.averages.relaxationScore}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Device Status */}
        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className={cn(
              "w-2 h-2 rounded-full",
              state.isTracking ? "bg-green-500 animate-pulse" : "bg-muted"
            )} />
            {state.isTracking ? "Simulating biometric data" : "Tracking paused"}
          </div>
          {!state.isTracking && (
            <Button variant="outline" size="sm" onClick={handleSimulate} className="touch-manipulation min-h-[44px]">
              Add Sample Reading
            </Button>
          )}
        </div>

        {/* HealthKit / Health Connect integration */}
        <div className="mt-4 pt-4 border-t">
          <HealthKitConnector />
        </div>

        {/* Manual heart rate input */}
        <div className="mt-4 pt-4 border-t">
          <ManualHeartRateInput />
        </div>
      </CardContent>
    </Card>
  );
});

BiometricMonitor.displayName = "BiometricMonitor";

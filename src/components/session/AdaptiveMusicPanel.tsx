import { useState, useEffect } from "react";
import { 
  Sparkles, Zap, Music2, TrendingUp, TrendingDown, 
  Minus, RefreshCw, Loader2, Radio, Target, Brain
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useAdaptiveMusic } from "@/hooks/useAdaptiveMusic";
import { cn } from "@/lib/utils";

interface AdaptiveMusicPanelProps {
  activityType: string;
  biometricState: {
    heartRate: number;
    stressLevel: number;
    focusScore: number;
    relaxationScore: number;
    flowState: "none" | "entering" | "in-flow" | "exiting";
  };
  isTracking: boolean;
  onSongRecommended?: (song: { title: string; artist: string; tempo: number; energy: number }) => void;
}

const actionIcons: Record<string, React.ReactNode> = {
  increase_tempo: <TrendingUp className="w-4 h-4 text-green-500" />,
  decrease_tempo: <TrendingDown className="w-4 h-4 text-blue-500" />,
  increase_energy: <Zap className="w-4 h-4 text-yellow-500" />,
  decrease_energy: <Minus className="w-4 h-4 text-purple-500" />,
  maintain: <Target className="w-4 h-4 text-emerald-500" />,
  change_genre: <Music2 className="w-4 h-4 text-pink-500" />,
};

const actionLabels: Record<string, string> = {
  increase_tempo: "Speed Up",
  decrease_tempo: "Slow Down",
  increase_energy: "More Energy",
  decrease_energy: "Calm Down",
  maintain: "Keep Going",
  change_genre: "Try Different",
};

export function AdaptiveMusicPanel({ 
  activityType, 
  biometricState, 
  isTracking,
  onSongRecommended 
}: AdaptiveMusicPanelProps) {
  const { 
    state, 
    enable, 
    disable, 
    updateBiometrics, 
    getImmediateRecommendation 
  } = useAdaptiveMusic(activityType);

  // Update biometrics whenever they change
  useEffect(() => {
    if (biometricState && isTracking) {
      updateBiometrics(biometricState);
    }
  }, [biometricState, isTracking, updateBiometrics]);

  // Auto-enable when tracking starts
  useEffect(() => {
    if (isTracking && !state.isEnabled) {
      enable(30000); // Update every 30 seconds
    } else if (!isTracking && state.isEnabled) {
      disable();
    }
  }, [isTracking, state.isEnabled, enable, disable]);

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      enable(30000);
    } else {
      disable();
    }
  };

  const handleRefresh = async () => {
    const recommendation = await getImmediateRecommendation();
    if (recommendation?.suggestedSongs?.[0] && onSongRecommended) {
      onSongRecommended(recommendation.suggestedSongs[0]);
    }
  };

  const recommendation = state.currentRecommendation;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="w-5 h-5 text-primary animate-pulse" />
              Adaptive Music AI
            </CardTitle>
            <CardDescription>
              Real-time recommendations based on your biometrics
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch 
              checked={state.isEnabled} 
              onCheckedChange={handleToggle}
              disabled={!isTracking}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={!isTracking || state.isLoading}
            >
              {state.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isTracking ? (
          <div className="text-center py-6 text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Start tracking biometrics to enable adaptive recommendations</p>
          </div>
        ) : !recommendation ? (
          <div className="text-center py-6">
            {state.isLoading ? (
              <>
                <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing your biometric data...</p>
              </>
            ) : (
              <>
                <Sparkles className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Collecting biometric data...</p>
                <Button 
                  variant="outline" 
                  className="mt-3"
                  onClick={handleRefresh}
                >
                  Get Recommendation Now
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Action Badge */}
            <div className="flex items-center justify-center">
              <Badge 
                variant="secondary" 
                className={cn(
                  "text-lg py-2 px-4 gap-2",
                  recommendation.action === "maintain" && "bg-emerald-500/20 text-emerald-600",
                  recommendation.action === "increase_tempo" && "bg-green-500/20 text-green-600",
                  recommendation.action === "decrease_tempo" && "bg-blue-500/20 text-blue-600",
                  recommendation.action === "increase_energy" && "bg-yellow-500/20 text-yellow-600",
                  recommendation.action === "decrease_energy" && "bg-purple-500/20 text-purple-600",
                )}
              >
                {actionIcons[recommendation.action]}
                {actionLabels[recommendation.action]}
              </Badge>
            </div>

            {/* Reasoning */}
            <p className="text-sm text-center text-muted-foreground">
              {recommendation.reasoning}
            </p>

            {/* Target Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold text-primary">
                  {recommendation.targetTempo}
                </div>
                <div className="text-xs text-muted-foreground">Target BPM</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold text-primary">
                  {Math.round(recommendation.targetEnergy * 100)}%
                </div>
                <div className="text-xs text-muted-foreground">Target Energy</div>
              </div>
            </div>

            {/* Flow Prediction */}
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Flow Prediction</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {recommendation.flowPrediction}
              </p>
            </div>

            {/* Suggested Songs */}
            {recommendation.suggestedSongs?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Music2 className="w-4 h-4" />
                  Suggested Songs
                </h4>
                <div className="space-y-2">
                  {recommendation.suggestedSongs.slice(0, 3).map((song, i) => (
                    <button
                      key={i}
                      onClick={() => onSongRecommended?.(song)}
                      className="w-full p-3 rounded-lg border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{song.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {song.tempo} BPM
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{song.artist}</div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>Energy</span>
                          <span>{Math.round(song.energy * 100)}%</span>
                        </div>
                        <Progress value={song.energy * 100} className="h-1" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Last Updated */}
            {state.lastUpdated && (
              <p className="text-xs text-center text-muted-foreground">
                Updated {formatTimeAgo(state.lastUpdated)}
              </p>
            )}
          </div>
        )}

        {state.error && (
          <div className="text-sm text-destructive text-center">
            {state.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

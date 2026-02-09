import { Music2, TrendingUp, Heart, Brain, Zap, Clock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StartingSongRecommendation } from "@/hooks/useActivityStartingSong";
import { cn } from "@/lib/utils";

interface ActivityStartingRecommendationProps {
  recommendation: StartingSongRecommendation;
  isLoading: boolean;
  activityName: string;
}

export function ActivityStartingRecommendation({
  recommendation,
  isLoading,
  activityName,
}: ActivityStartingRecommendationProps) {
  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardContent className="py-6 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading your {activityName} profile...</span>
        </CardContent>
      </Card>
    );
  }

  const { hasHistory, optimalTempo, optimalEnergy, topSongs, lastSessionSummary } = recommendation;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background overflow-hidden">
      <CardContent className="pt-5 pb-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Music2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">
              {hasHistory ? "Your Starting Point" : "Recommended Starting Point"}
            </h4>
            <p className="text-xs text-muted-foreground">
              {hasHistory
                ? `Based on your last ${activityName} sessions`
                : `Default profile for ${activityName}`}
            </p>
          </div>
        </div>

        {/* Optimal Targets */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-xl font-bold text-primary">{optimalTempo}</div>
            <div className="text-xs text-muted-foreground">Optimal BPM</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-xl font-bold text-primary">{Math.round(optimalEnergy * 100)}%</div>
            <div className="text-xs text-muted-foreground">Optimal Energy</div>
          </div>
        </div>

        {/* Last Session Summary */}
        {lastSessionSummary && (
          <div className="p-3 rounded-lg bg-muted/30 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Session</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {lastSessionSummary.avgHeartRate != null && (
                <div className="flex flex-col items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-sm font-medium">{lastSessionSummary.avgHeartRate}</span>
                  <span className="text-[10px] text-muted-foreground">Avg HR</span>
                </div>
              )}
              {lastSessionSummary.avgFocusScore != null && (
                <div className="flex flex-col items-center gap-1">
                  <Brain className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-sm font-medium">{lastSessionSummary.avgFocusScore}%</span>
                  <span className="text-[10px] text-muted-foreground">Focus</span>
                </div>
              )}
              {lastSessionSummary.sessionDurationMin != null && (
                <div className="flex flex-col items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-sm font-medium">{lastSessionSummary.sessionDurationMin}m</span>
                  <span className="text-[10px] text-muted-foreground">Duration</span>
                </div>
              )}
            </div>
            {lastSessionSummary.moodBefore && lastSessionSummary.moodAfter && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <Badge variant="outline" className="text-xs capitalize">{lastSessionSummary.moodBefore}</Badge>
                <TrendingUp className="w-3 h-3 text-muted-foreground" />
                <Badge variant="outline" className="text-xs capitalize">{lastSessionSummary.moodAfter}</Badge>
              </div>
            )}
          </div>
        )}

        {/* Top Songs from History */}
        {topSongs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Your top tracks for {activityName}
            </p>
            <div className="space-y-1.5">
              {topSongs.slice(0, 3).map((song, i) => (
                <div
                  key={song.id}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-lg border transition-colors",
                    i === 0
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/50 bg-muted/20"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    {song.tempo && <span>{song.tempo} BPM</span>}
                    {song.energy != null && (
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        <Zap className="w-2.5 h-2.5 mr-0.5" />
                        {Math.round(song.energy * 100)}%
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasHistory && (
          <p className="text-xs text-center text-muted-foreground italic">
            Complete your first {activityName} session to get personalized recommendations!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

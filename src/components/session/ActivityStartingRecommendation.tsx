import { memo } from "react";
import { Loader2, Music, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { StartingSongRecommendation } from "@/hooks/useActivityStartingSong";

interface ActivityStartingRecommendationProps {
  recommendation: StartingSongRecommendation;
  isLoading: boolean;
  activityName: string;
}

// Pre-session preparation card: shows the personalized optimal tempo/energy
// for this activity and the songs that performed best in past sessions.
export const ActivityStartingRecommendation = memo(function ActivityStartingRecommendation({
  recommendation,
  isLoading,
  activityName,
}: ActivityStartingRecommendationProps) {
  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-muted/30">
        <CardContent className="flex items-center gap-3 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            Analyzing your past {activityName} sessions…
          </span>
        </CardContent>
      </Card>
    );
  }

  const { optimalTempo, optimalEnergy, topSongs, lastSessionSummary, hasHistory } = recommendation;

  return (
    <Card className="border-primary/20 bg-muted/30">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {hasHistory ? "Your personalized starting point" : "Recommended starting point"}
          </span>
          {!hasHistory && (
            <Badge variant="secondary" className="text-xs">
              builds with each session
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline" className="gap-1">
            <TrendingUp className="h-3 w-3" />
            ~{Math.round(optimalTempo)} BPM
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Music className="h-3 w-3" />
            {Math.round(optimalEnergy * 100)}% energy
          </Badge>
        </div>

        {topSongs.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Songs that worked best for {activityName}:
            </p>
            <ul className="space-y-1">
              {topSongs.slice(0, 3).map((song) => (
                <li key={song.id} className="truncate text-sm">
                  <span className="font-medium">{song.title}</span>
                  <span className="text-muted-foreground"> — {song.artist}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {lastSessionSummary && (
          <p className="text-xs text-muted-foreground">
            Last session: {lastSessionSummary.sessionDurationMin ?? "–"} min
            {lastSessionSummary.avgHeartRate ? ` · avg ${Math.round(lastSessionSummary.avgHeartRate)} BPM` : ""}
            {lastSessionSummary.moodBefore && lastSessionSummary.moodAfter
              ? ` · mood ${lastSessionSummary.moodBefore} → ${lastSessionSummary.moodAfter}`
              : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
});

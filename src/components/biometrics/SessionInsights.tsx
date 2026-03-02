import { forwardRef } from "react";
import { useSessionAnalytics, ActivityInsight } from "@/hooks/useSessionAnalytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, Brain, Clock, Heart, Music, Target, TrendingUp, 
  Zap, Moon, Dumbbell, BookOpen, Coffee, Car, Loader2, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const activityIcons: Record<string, React.ReactNode> = {
  sleep: <Moon className="w-4 h-4" />,
  workout: <Dumbbell className="w-4 h-4" />,
  study: <BookOpen className="w-4 h-4" />,
  relax: <Coffee className="w-4 h-4" />,
  commute: <Car className="w-4 h-4" />,
};

function InsightCard({ insight }: { insight: ActivityInsight }) {
  const icon = activityIcons[insight.activityName] || <Music className="w-4 h-4" />;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg capitalize">{insight.activityName}</CardTitle>
              <CardDescription>{insight.totalSessions} sessions analyzed</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <Target className="w-3 h-3" />
            {Math.round(insight.avgFlowStateTime)}% Flow
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Optimal Music Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <Zap className="w-4 h-4 text-yellow-500" />
              Optimal BPM
            </div>
            <p className="text-2xl font-bold">{insight.recommendedBpm}</p>
            <p className="text-xs text-muted-foreground">
              Range: {insight.bestTempoRange.min.toFixed(0)} - {insight.bestTempoRange.max.toFixed(0)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Energy Level
            </div>
            <p className="text-2xl font-bold">
              {((insight.bestEnergyRange.min + insight.bestEnergyRange.max) / 2 * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">
              Range: {(insight.bestEnergyRange.min * 100).toFixed(0)}% - {(insight.bestEnergyRange.max * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="flex items-center gap-1">
                <Brain className="w-3 h-3 text-purple-500" />
                Focus Score
              </span>
              <span className="font-medium">{insight.avgFocusScore}%</span>
            </div>
            <Progress value={insight.avgFocusScore} className="h-2 [&>div]:bg-purple-500" />
          </div>
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-green-500" />
                Relaxation
              </span>
              <span className="font-medium">{insight.avgRelaxationScore}%</span>
            </div>
            <Progress value={insight.avgRelaxationScore} className="h-2 [&>div]:bg-green-500" />
          </div>
        </div>

        {/* Top Songs */}
        {insight.topSongs.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Best Performing Songs</p>
            <div className="space-y-2">
              {insight.topSongs.slice(0, 3).map((song) => (
                <div 
                  key={song.songId}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Music className="w-3 h-3 text-primary shrink-0" />
                    <span className="truncate">{song.title}</span>
                    <span className="text-muted-foreground truncate">- {song.artist}</span>
                  </div>
                  <Badge variant="secondary" className="shrink-0 ml-2">
                    {Math.round(song.avgFocusScore)}% focus
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Avg Duration: {insight.avgSessionDuration} min
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function OverallStats({ insights, overall }: { insights: ActivityInsight[]; overall: any }) {
  if (!overall) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Clock className="w-4 h-4" />
            Total Listening
          </div>
          <p className="text-2xl font-bold">{overall.totalListeningTime} min</p>
          <p className="text-xs text-muted-foreground">{overall.totalSessions} sessions</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Target className="w-4 h-4" />
            Flow State
          </div>
          <p className="text-2xl font-bold">{overall.flowStatePercentage}%</p>
          <p className="text-xs text-muted-foreground">of listening time</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Brain className="w-4 h-4" />
            Most Productive
          </div>
          <p className="text-2xl font-bold capitalize">{overall.mostProductiveActivity}</p>
          <p className="text-xs text-muted-foreground">highest focus scores</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Heart className="w-4 h-4" />
            Most Relaxing
          </div>
          <p className="text-2xl font-bold capitalize">{overall.mostRelaxingActivity}</p>
          <p className="text-xs text-muted-foreground">lowest stress levels</p>
        </CardContent>
      </Card>
    </div>
  );
}

export const SessionInsights = forwardRef<HTMLDivElement>((_, ref) => {
  const { activityInsights, overallInsights, isLoading, error, refreshAnalytics } = useSessionAnalytics();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Session Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={refreshAnalytics}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasData = activityInsights.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Session Analytics & Flow Insights
          </h2>
          <p className="text-sm text-muted-foreground">
            Discover which music helps you achieve flow state in each activity
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAnalytics}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      {!hasData ? (
        <Card className="p-8 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">No Analytics Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Start tracking your listening sessions with biometric data to see personalized insights 
            about which songs and BPM work best for each activity.
          </p>
        </Card>
      ) : (
        <>
          <OverallStats insights={activityInsights} overall={overallInsights} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activityInsights.map((insight) => (
              <InsightCard key={insight.activityId} insight={insight} />
            ))}
          </div>
        </>
      )}
    </div>
  );
});

SessionInsights.displayName = "SessionInsights";

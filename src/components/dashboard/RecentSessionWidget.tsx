import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Clock, Activity, Brain, TrendingUp, Zap } from "lucide-react";
import { formatDistanceToNow, differenceInCalendarDays, parseISO } from "date-fns";
import { useCurrentUser, useUserSessions, useActivityTypes, useSessionBiometrics } from "@/hooks/useDashboardData";

export const RecentSessionWidget = () => {
  const { data: user } = useCurrentUser();
  const { data: sessions, isLoading } = useUserSessions(user?.id);
  const { data: activityTypes } = useActivityTypes();

  const latestSession = sessions?.[0];
  const { data: biometrics } = useSessionBiometrics(latestSession?.id);

  const { streak, totalSessions, lastSession } = useMemo(() => {
    if (!sessions || sessions.length === 0) {
      return { streak: 0, totalSessions: 0, lastSession: null };
    }

    // Calculate streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessionDays = new Set(
      sessions.map((s) => {
        const d = new Date(s.started_at);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    );
    const sortedDays = Array.from(sessionDays).sort((a, b) => b - a);
    let currentStreak = 0;
    const diffFromToday = differenceInCalendarDays(today, new Date(sortedDays[0]));
    if (diffFromToday <= 1) {
      currentStreak = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        if (differenceInCalendarDays(new Date(sortedDays[i - 1]), new Date(sortedDays[i])) === 1) {
          currentStreak++;
        } else break;
      }
    }

    const latest = sessions[0];
    const activityName = activityTypes?.find((a) => a.id === latest.activity_type_id)?.name || "Unknown";
    const durationMs = latest.ended_at
      ? new Date(latest.ended_at).getTime() - new Date(latest.started_at).getTime()
      : 0;

    const avgFocus = biometrics?.length
      ? Math.round(biometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / biometrics.length)
      : null;
    const avgHR = biometrics?.length
      ? Math.round(biometrics.reduce((sum, b) => sum + (b.heart_rate || 0), 0) / biometrics.filter(b => b.heart_rate).length)
      : null;

    return {
      streak: currentStreak,
      totalSessions: sessions.length,
      lastSession: {
        ...latest,
        activity_name: activityName,
        duration_min: Math.round(durationMs / 60000),
        avg_focus: avgFocus,
        avg_heart_rate: avgHR,
      },
    };
  }, [sessions, activityTypes, biometrics]);

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader><CardTitle className="h-6 bg-muted rounded w-48" /></CardHeader>
        <CardContent><div className="h-20 bg-muted rounded" /></CardContent>
      </Card>
    );
  }

  if (!lastSession) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5 text-primary" />
            Session Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No sessions yet. Start your first listening session above!</p>
        </CardContent>
      </Card>
    );
  }

  const moodImproved =
    lastSession.mood_before &&
    lastSession.mood_after &&
    getMoodScore(lastSession.mood_after) > getMoodScore(lastSession.mood_before);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <Flame className="w-8 h-8 text-destructive" />
            <span className="text-4xl font-bold text-primary">{streak}</span>
          </div>
          <p className="text-sm font-medium">Day Streak</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalSessions} total session{totalSessions !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="w-5 h-5 text-primary" />
            Last Session
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {formatDistanceToNow(parseISO(lastSession.started_at), { addSuffix: true })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <StatPill icon={<Activity className="w-4 h-4" />} label="Activity" value={lastSession.activity_name} />
            <StatPill icon={<Clock className="w-4 h-4" />} label="Duration" value={`${lastSession.duration_min} min`} />
            {lastSession.avg_focus !== null && (
              <StatPill icon={<Brain className="w-4 h-4" />} label="Avg Focus" value={`${lastSession.avg_focus}%`} />
            )}
            {lastSession.avg_heart_rate !== null && (
              <StatPill icon={<Activity className="w-4 h-4" />} label="Avg HR" value={`${lastSession.avg_heart_rate} bpm`} />
            )}
            {moodImproved && (
              <StatPill icon={<TrendingUp className="w-4 h-4 text-primary" />} label="Mood" value="Improved ✓" highlight />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StatPill = ({
  icon, label, value, highlight = false,
}: {
  icon: React.ReactNode; label: string; value: string; highlight?: boolean;
}) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${highlight ? "bg-primary/10" : "bg-muted/50"}`}>
    <span className="text-muted-foreground">{icon}</span>
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold capitalize ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  </div>
);

function getMoodScore(mood: string): number {
  const scores: Record<string, number> = {
    terrible: 1, bad: 2, poor: 2, okay: 3, neutral: 3, good: 4, great: 5, amazing: 5, excellent: 5,
  };
  return scores[mood.toLowerCase()] || 3;
}

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Heart, Clock, Flame } from "lucide-react";
import { differenceInCalendarDays, startOfWeek, endOfWeek, formatDistanceToNow } from "date-fns";
import { useCurrentUser, useUserSessions, useAllBiometrics } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";

function computeStreak(sessions: { started_at: string }[]): number {
  if (!sessions.length) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from(
    new Set(sessions.map((s) => { const d = new Date(s.started_at); d.setHours(0, 0, 0, 0); return d.getTime(); }))
  ).sort((a, b) => b - a);
  const diff = differenceInCalendarDays(today, new Date(days[0]));
  if (diff > 1) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (differenceInCalendarDays(new Date(days[i - 1]), new Date(days[i])) === 1) streak++;
    else break;
  }
  return streak;
}

export const QuickStatsRow = () => {
  const { data: user } = useCurrentUser();
  const { data: sessions, isLoading: sessionsLoading } = useUserSessions(user?.id);
  const { data: biometrics, isLoading: bioLoading } = useAllBiometrics(user?.id);

  const stats = useMemo(() => {
    if (!sessions) return null;
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const thisWeekSessions = sessions.filter(
      (s) => new Date(s.started_at) >= weekStart && new Date(s.started_at) <= weekEnd
    );

    const totalMinutes = thisWeekSessions.reduce((sum, s) => {
      if (!s.ended_at) return sum;
      return sum + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
    }, 0);

    const weekBiometrics = (biometrics || []).filter(
      (b) => new Date(b.recorded_at) >= weekStart && new Date(b.recorded_at) <= weekEnd
    );
    const hrReadings = weekBiometrics.filter((b) => b.heart_rate && b.heart_rate > 0);
    const avgHR = hrReadings.length > 0
      ? Math.round(hrReadings.reduce((sum, b) => sum + (b.heart_rate || 0), 0) / hrReadings.length)
      : 0;

    const lastSessionDate = sessions.length > 0
      ? new Date(sessions.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0].started_at)
      : null;

    return {
      sessionsThisWeek: thisWeekSessions.length,
      avgHR,
      totalMinutes: Math.round(totalMinutes),
      streak: computeStreak(sessions),
      lastSessionDate,
    };
  }, [sessions, biometrics]);

  if (sessionsLoading || bioLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const sessionsSubtitle = stats.sessionsThisWeek === 0 && stats.lastSessionDate
    ? `Last session: ${formatDistanceToNow(stats.lastSessionDate, { addSuffix: true })}`
    : undefined;

  const items = [
    { icon: Activity, label: "Sessions This Week", value: stats.sessionsThisWeek.toString(), color: "text-primary", subtitle: sessionsSubtitle },
    { icon: Heart, label: "Avg HR This Week", value: stats.avgHR ? `${stats.avgHR} bpm` : "—", color: "text-destructive" },
    { icon: Clock, label: "Minutes This Week", value: `${stats.totalMinutes}`, color: "text-blue-500" },
    { icon: Flame, label: "Day Streak", value: stats.streak.toString(), color: "text-orange-500" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full bg-muted ${item.color}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

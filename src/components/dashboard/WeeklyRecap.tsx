import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { differenceInCalendarDays, startOfWeek, endOfWeek, format } from "date-fns";
import { Bell, X, TrendingUp, TrendingDown, Minus, Flame, Target, Music } from "lucide-react";

const RECAP_DISMISSED_KEY = "mindtune_recap_dismissed";

interface WeeklyStats {
  sessionsThisWeek: number;
  sessionsLastWeek: number;
  currentStreak: number;
  totalSessions: number;
  topActivity: string | null;
  newBadgesThisWeek: string[];
  weekStart: Date;
  weekEnd: Date;
}

function computeStreak(sessions: { started_at: string }[]): number {
  if (!sessions.length) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from(
    new Set(
      sessions.map((s) => {
        const d = new Date(s.started_at);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    )
  ).sort((a, b) => b - a);

  const diff = differenceInCalendarDays(today, new Date(days[0]));
  if (diff > 1) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (differenceInCalendarDays(new Date(days[i - 1]), new Date(days[i])) === 1) {
      streak++;
    } else break;
  }
  return streak;
}

const BADGE_THRESHOLDS = [
  { id: "first", name: "First Note", emoji: "🎵", target: 1 },
  { id: "five", name: "Getting Started", emoji: "🎶", target: 5 },
  { id: "ten", name: "On Fire", emoji: "🔥", target: 10 },
  { id: "twentyfive", name: "Star Listener", emoji: "⭐", target: 25 },
  { id: "fifty", name: "Diamond Ears", emoji: "💎", target: 50 },
];

export const WeeklyRecap = () => {
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dismissedDate = localStorage.getItem(RECAP_DISMISSED_KEY);
    if (dismissedDate) {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      if (new Date(dismissedDate) >= weekStart) {
        setDismissed(true);
        setLoading(false);
        return;
      }
    }
    fetchWeeklyStats();
  }, []);

  const fetchWeeklyStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      const { data: allSessions } = await supabase
        .from("listening_sessions")
        .select("started_at, activity_type_id")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false });

      if (!allSessions) {
        setLoading(false);
        return;
      }

      const thisWeekSessions = allSessions.filter(
        (s) => new Date(s.started_at) >= weekStart && new Date(s.started_at) <= weekEnd
      );
      const lastWeekSessions = allSessions.filter(
        (s) => new Date(s.started_at) >= lastWeekStart && new Date(s.started_at) < weekStart
      );

      // Top activity this week
      const activityCounts: Record<string, number> = {};
      thisWeekSessions.forEach((s) => {
        activityCounts[s.activity_type_id] = (activityCounts[s.activity_type_id] || 0) + 1;
      });
      const topActivityId = Object.entries(activityCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

      let topActivity: string | null = null;
      if (topActivityId) {
        const { data: activity } = await supabase
          .from("activity_types")
          .select("name")
          .eq("id", topActivityId)
          .single();
        topActivity = activity?.name || null;
      }

      // Check for badges earned this week
      const totalBeforeThisWeek = allSessions.length - thisWeekSessions.length;
      const totalNow = allSessions.length;
      const newBadges = BADGE_THRESHOLDS.filter(
        (b) => totalBeforeThisWeek < b.target && totalNow >= b.target
      ).map((b) => `${b.emoji} ${b.name}`);

      setStats({
        sessionsThisWeek: thisWeekSessions.length,
        sessionsLastWeek: lastWeekSessions.length,
        currentStreak: computeStreak(allSessions),
        totalSessions: allSessions.length,
        topActivity,
        newBadgesThisWeek: newBadges,
        weekStart,
        weekEnd,
      });
    } catch (err) {
      console.error("Error fetching weekly stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(RECAP_DISMISSED_KEY, new Date().toISOString());
  };

  if (loading || dismissed || !stats) return null;
  if (stats.sessionsThisWeek === 0 && stats.sessionsLastWeek === 0) return null;

  const trend = stats.sessionsThisWeek - stats.sessionsLastWeek;
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? "text-green-500" : trend < 0 ? "text-red-400" : "text-muted-foreground";
  const trendText = trend > 0 ? `+${trend} vs last week` : trend < 0 ? `${trend} vs last week` : "Same as last week";

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent relative overflow-hidden">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
      >
        <X className="w-4 h-4" />
      </Button>

      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="w-5 h-5 text-primary" />
          Weekly Recap
          <span className="text-xs font-normal text-muted-foreground">
            {format(stats.weekStart, "MMM d")} – {format(stats.weekEnd, "MMM d")}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Sessions this week */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Sessions</span>
            </div>
            <p className="text-2xl font-bold">{stats.sessionsThisWeek}</p>
            <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
              <TrendIcon className="w-3 h-3" />
              {trendText}
            </div>
          </div>

          {/* Current streak */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium">Streak</span>
            </div>
            <p className="text-2xl font-bold">{stats.currentStreak}</p>
            <p className="text-xs text-muted-foreground">day{stats.currentStreak !== 1 ? "s" : ""} in a row</p>
          </div>

          {/* Top activity */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Music className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Top Activity</span>
            </div>
            <p className="text-lg font-bold capitalize">{stats.topActivity || "—"}</p>
            <p className="text-xs text-muted-foreground">most played</p>
          </div>

          {/* Total progress */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">All-Time</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalSessions}</p>
            <p className="text-xs text-muted-foreground">total sessions</p>
          </div>
        </div>

        {/* New badges earned this week */}
        {stats.newBadgesThisWeek.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-sm font-medium mb-1.5">🎉 Badges earned this week:</p>
            <div className="flex flex-wrap gap-2">
              {stats.newBadgesThisWeek.map((badge, i) => (
                <span
                  key={i}
                  className="text-sm bg-primary/10 text-primary px-2.5 py-1 rounded-full"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

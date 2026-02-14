import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { differenceInCalendarDays } from "date-fns";
import { Trophy } from "lucide-react";

interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  unlocked: boolean;
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

function buildBadges(total: number, streak: number): Badge[] {
  return [
    { id: "first", emoji: "🎵", name: "First Note", description: "Complete your first session", unlocked: total >= 1 },
    { id: "five", emoji: "🎶", name: "Getting Started", description: "Complete 5 sessions", unlocked: total >= 5 },
    { id: "ten", emoji: "🔥", name: "On Fire", description: "Complete 10 sessions", unlocked: total >= 10 },
    { id: "twentyfive", emoji: "⭐", name: "Star Listener", description: "Complete 25 sessions", unlocked: total >= 25 },
    { id: "fifty", emoji: "💎", name: "Diamond Ears", description: "Complete 50 sessions", unlocked: total >= 50 },
    { id: "streak3", emoji: "🔗", name: "Chain Starter", description: "3-day streak", unlocked: streak >= 3 },
    { id: "streak7", emoji: "🏆", name: "Weekly Warrior", description: "7-day streak", unlocked: streak >= 7 },
    { id: "streak14", emoji: "👑", name: "Two-Week King", description: "14-day streak", unlocked: streak >= 14 },
    { id: "streak30", emoji: "🌟", name: "Monthly Master", description: "30-day streak", unlocked: streak >= 30 },
  ];
}

export const AchievementBadges = () => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: sessions } = await supabase
        .from("listening_sessions")
        .select("started_at")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false });

      const total = sessions?.length || 0;
      const streak = sessions ? computeStreak(sessions) : 0;
      setBadges(buildBadges(total, streak));
    } catch (err) {
      console.error("Error fetching achievements:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader><div className="h-6 bg-muted rounded w-40" /></CardHeader>
        <CardContent><div className="h-24 bg-muted rounded" /></CardContent>
      </Card>
    );
  }

  const unlocked = badges.filter((b) => b.unlocked).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="w-5 h-5 text-primary" />
          Achievements
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {unlocked}/{badges.length} unlocked
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`flex flex-col items-center text-center p-3 rounded-xl transition-all ${
                badge.unlocked
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-muted/30 opacity-40 grayscale"
              }`}
              title={badge.description}
            >
              <span className="text-2xl mb-1">{badge.emoji}</span>
              <p className="text-[10px] font-medium leading-tight">{badge.name}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

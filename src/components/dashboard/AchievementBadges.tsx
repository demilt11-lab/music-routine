import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { differenceInCalendarDays } from "date-fns";
import { Trophy, Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  unlocked: boolean;
  current: number;
  target: number;
}

const STORAGE_KEY = "mindtune_unlocked_badges";

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
    { id: "first", emoji: "🎵", name: "First Note", description: "Complete your first session", unlocked: total >= 1, current: Math.min(total, 1), target: 1 },
    { id: "five", emoji: "🎶", name: "Getting Started", description: "Complete 5 sessions", unlocked: total >= 5, current: Math.min(total, 5), target: 5 },
    { id: "ten", emoji: "🔥", name: "On Fire", description: "Complete 10 sessions", unlocked: total >= 10, current: Math.min(total, 10), target: 10 },
    { id: "twentyfive", emoji: "⭐", name: "Star Listener", description: "Complete 25 sessions", unlocked: total >= 25, current: Math.min(total, 25), target: 25 },
    { id: "fifty", emoji: "💎", name: "Diamond Ears", description: "Complete 50 sessions", unlocked: total >= 50, current: Math.min(total, 50), target: 50 },
    { id: "streak3", emoji: "🔗", name: "Chain Starter", description: "3-day streak", unlocked: streak >= 3, current: Math.min(streak, 3), target: 3 },
    { id: "streak7", emoji: "🏆", name: "Weekly Warrior", description: "7-day streak", unlocked: streak >= 7, current: Math.min(streak, 7), target: 7 },
    { id: "streak14", emoji: "👑", name: "Two-Week King", description: "14-day streak", unlocked: streak >= 14, current: Math.min(streak, 14), target: 14 },
    { id: "streak30", emoji: "🌟", name: "Monthly Master", description: "30-day streak", unlocked: streak >= 30, current: Math.min(streak, 30), target: 30 },
  ];
}

export const AchievementBadges = () => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [newBadgeIds, setNewBadgeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const toastsFired = useRef(false);

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
      const computed = buildBadges(total, streak);

      // Detect newly unlocked badges
      const prevUnlocked: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const currentUnlocked = computed.filter((b) => b.unlocked).map((b) => b.id);
      const freshlyUnlocked = currentUnlocked.filter((id) => !prevUnlocked.includes(id));

      setNewBadgeIds(new Set(freshlyUnlocked));
      setBadges(computed);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUnlocked));

      if (!toastsFired.current && freshlyUnlocked.length > 0) {
        toastsFired.current = true;
        freshlyUnlocked.forEach((id, i) => {
          const badge = computed.find((b) => b.id === id);
          if (badge) {
            setTimeout(() => {
              toast.success(`${badge.emoji} Badge Unlocked: ${badge.name}!`, {
                description: badge.description,
                duration: 5000,
              });
            }, i * 800);
          }
        });
      }
    } catch (err) {
      console.error("Error fetching achievements:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const unlockedBadges = badges.filter((b) => b.unlocked);
    const total = badges.length;
    const lines = [
      `🏆 My MindTune Achievements (${unlockedBadges.length}/${total})`,
      "",
      ...unlockedBadges.map((b) => `${b.emoji} ${b.name} — ${b.description}`),
      "",
      "🎧 Track your focus with music at MindTune!",
    ];
    const text = lines.join("\n");

    // Try native share first, fallback to clipboard
    if (navigator.share) {
      try {
        await navigator.share({ title: "My MindTune Achievements", text });
        return;
      } catch {
        // User cancelled or not supported, fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Achievements copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy achievements");
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
          <span className="text-sm font-normal text-muted-foreground">
            {unlocked}/{badges.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5"
            onClick={handleShare}
          >
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {copied ? "Copied" : "Share"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
          {badges.map((badge) => {
            const isNew = newBadgeIds.has(badge.id);
            const progressPct = badge.unlocked ? 100 : Math.round((badge.current / badge.target) * 100);

            return (
              <div
                key={badge.id}
                className={`flex flex-col items-center text-center p-3 rounded-xl transition-all ${
                  badge.unlocked
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-muted/30 border border-transparent"
                } ${isNew ? "animate-scale-in ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                title={badge.description}
              >
                <span className={`text-2xl mb-1 ${isNew ? "animate-bounce" : ""} ${!badge.unlocked ? "grayscale opacity-50" : ""}`}>
                  {badge.emoji}
                </span>
                <p className={`text-[10px] font-medium leading-tight mb-1 ${!badge.unlocked ? "text-muted-foreground" : ""}`}>
                  {badge.name}
                </p>

                {badge.unlocked ? (
                  isNew && (
                    <span className="text-[8px] font-bold uppercase tracking-widest text-primary">
                      New!
                    </span>
                  )
                ) : (
                  <div className="w-full mt-1 space-y-0.5">
                    <Progress value={progressPct} className="h-1" />
                    <p className="text-[8px] text-muted-foreground">
                      {badge.current}/{badge.target}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

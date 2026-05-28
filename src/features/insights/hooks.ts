import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/query";
import { useAuth } from "@/app/auth";
import type { Activity, SessionRow } from "@/lib/database.types";

export type InsightsRange = "week" | "month";

export interface Insights {
  totalSessions: number;
  totalMinutes: number;
  avgFlow: number | null;
  byActivity: Array<{ activity: Activity; minutes: number; sessions: number }>;
  daily: Array<{ date: string; minutes: number }>;
}

function durationMinutes(s: SessionRow): number {
  if (!s.ended_at) return 0;
  return Math.max(0, Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000));
}

export function useInsights(range: InsightsRange) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.insights(range),
    enabled: !!user,
    queryFn: async (): Promise<Insights> => {
      const days = range === "week" ? 7 : 30;
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", user!.id)
        .gte("started_at", since)
        .order("started_at");
      if (error) throw error;
      const sessions = data ?? [];

      const byActivityMap = new Map<Activity, { minutes: number; sessions: number }>();
      const dailyMap = new Map<string, number>();
      let totalMinutes = 0;
      const flows: number[] = [];

      for (const s of sessions) {
        const mins = durationMinutes(s);
        totalMinutes += mins;
        if (s.avg_flow_score != null) flows.push(s.avg_flow_score);

        const a = byActivityMap.get(s.activity) ?? { minutes: 0, sessions: 0 };
        a.minutes += mins;
        a.sessions += 1;
        byActivityMap.set(s.activity, a);

        const day = s.started_at.slice(0, 10);
        dailyMap.set(day, (dailyMap.get(day) ?? 0) + mins);
      }

      // Dense daily series so charts render an unbroken timeline.
      const daily: Insights["daily"] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
        daily.push({ date, minutes: dailyMap.get(date) ?? 0 });
      }

      return {
        totalSessions: sessions.length,
        totalMinutes,
        avgFlow: flows.length ? flows.reduce((s, f) => s + f, 0) / flows.length : null,
        byActivity: [...byActivityMap.entries()].map(([activity, v]) => ({ activity, ...v })),
        daily,
      };
    },
  });
}

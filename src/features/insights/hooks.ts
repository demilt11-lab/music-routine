import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/query";
import { useAuth } from "@/app/auth";
import type { Activity } from "@/lib/database.types";

export type InsightsRange = "week" | "month";

export interface Insights {
  totalSessions: number;
  totalMinutes: number;
  avgFlow: number | null;
  byActivity: Array<{ activity: Activity; minutes: number; sessions: number }>;
  daily: Array<{ date: string; minutes: number }>;
}

const EMPTY: Insights = { totalSessions: 0, totalMinutes: 0, avgFlow: null, byActivity: [], daily: [] };

/**
 * Insights are aggregated in Postgres (`get_insights` RPC) rather than by
 * pulling every session row to the client. The server returns a compact
 * summary — a few hundred bytes regardless of how many sessions the user has —
 * which keeps payloads flat and the work on the database where it indexes well.
 */
export function useInsights(range: InsightsRange) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.insights(range),
    enabled: !!user,
    queryFn: async (): Promise<Insights> => {
      const rangeDays = range === "week" ? 7 : 30;
      const { data, error } = await supabase.rpc("get_insights", { range_days: rangeDays });
      if (error) throw error;
      return (data as Insights | null) ?? EMPTY;
    },
  });
}

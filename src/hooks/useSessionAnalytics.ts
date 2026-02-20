import { useMemo, useCallback } from "react";
import { useCurrentUser, useSessionsDetailed, useAllBiometrics } from "@/hooks/useDashboardData";

export interface SongPerformance {
  songId: string;
  title: string;
  artist: string;
  tempo: number | null;
  energy: number | null;
  valence: number | null;
  avgFocusScore: number;
  avgRelaxationScore: number;
  avgStressLevel: number;
  avgHeartRate: number;
  playCount: number;
  skipRate: number;
  flowStateAchieved: boolean;
}

export interface ActivityInsight {
  activityId: string;
  activityName: string;
  totalSessions: number;
  avgSessionDuration: number;
  bestTempoRange: { min: number; max: number };
  bestEnergyRange: { min: number; max: number };
  topSongs: SongPerformance[];
  avgFlowStateTime: number;
  avgFocusScore: number;
  avgRelaxationScore: number;
  avgStressReduction: number;
  recommendedBpm: number;
}

export interface OverallInsights {
  totalListeningTime: number;
  totalSessions: number;
  flowStatePercentage: number;
  mostProductiveActivity: string;
  mostRelaxingActivity: string;
  optimalHeartRateZone: { min: number; max: number };
  peakFocusHours: number[];
}

interface UseSessionAnalyticsReturn {
  activityInsights: ActivityInsight[];
  overallInsights: OverallInsights | null;
  isLoading: boolean;
  error: string | null;
  refreshAnalytics: () => void;
}

export function useSessionAnalytics(): UseSessionAnalyticsReturn {
  const { data: user } = useCurrentUser();
  const { data: sessions, error: sessionsError, isLoading: sessionsLoading, refetch: refetchSessions } = useSessionsDetailed(user?.id);
  const { data: biometrics, isLoading: biometricsLoading, refetch: refetchBiometrics } = useAllBiometrics(user?.id);

  const { activityInsights, overallInsights } = useMemo(() => {
    if (!sessions || !biometrics) return { activityInsights: [], overallInsights: null };

    // Group sessions by activity
    const activityMap = new Map<string, {
      sessions: typeof sessions;
      biometrics: typeof biometrics;
    }>();

    sessions.forEach((session) => {
      const activityId = session.activity_type_id;
      if (!activityMap.has(activityId)) {
        activityMap.set(activityId, { sessions: [], biometrics: [] });
      }
      activityMap.get(activityId)!.sessions.push(session);
    });

    // Associate biometrics with sessions
    biometrics.forEach((reading) => {
      const session = sessions.find((s) => s.id === reading.session_id);
      if (session) {
        const activityId = session.activity_type_id;
        activityMap.get(activityId)?.biometrics?.push(reading);
      }
    });

    // Calculate insights for each activity
    const insights: ActivityInsight[] = [];
    
    activityMap.forEach((data, activityId) => {
      const activitySessions = data.sessions;
      const activityBiometrics = data.biometrics || [];
      
      if (activitySessions.length === 0) return;

      const activityName = activitySessions[0]?.activity_types?.name || "Unknown";

      const durations = activitySessions.map((s) => {
        if (s.ended_at && s.started_at) {
          return new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
        }
        return 0;
      }).filter((d) => d > 0);

      const avgDuration = durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length / 60000 
        : 0;

      const songPerformanceMap = new Map<string, SongPerformance>();
      
      activitySessions.forEach((session) => {
        session.session_songs?.forEach((ss: any) => {
          if (!ss.songs) return;
          
          const songId = ss.song_id;
          const existing = songPerformanceMap.get(songId);
          
          const sessionBiometrics = activityBiometrics.filter(
            (b: any) => b.session_id === session.id
          );
          
          const avgFocus = sessionBiometrics.length > 0
            ? sessionBiometrics.reduce((sum: number, b: any) => sum + (b.focus_score || 0), 0) / sessionBiometrics.length
            : 50;
          const avgRelax = sessionBiometrics.length > 0
            ? sessionBiometrics.reduce((sum: number, b: any) => sum + (b.relaxation_score || 0), 0) / sessionBiometrics.length
            : 50;
          const avgStress = sessionBiometrics.length > 0
            ? sessionBiometrics.reduce((sum: number, b: any) => sum + (b.stress_level || 0), 0) / sessionBiometrics.length
            : 30;
          const avgHr = sessionBiometrics.length > 0
            ? sessionBiometrics.reduce((sum: number, b: any) => sum + (b.heart_rate || 70), 0) / sessionBiometrics.length
            : 70;

          if (existing) {
            existing.playCount++;
            existing.skipRate = (existing.skipRate * (existing.playCount - 1) + (ss.skipped ? 1 : 0)) / existing.playCount;
            existing.avgFocusScore = (existing.avgFocusScore * (existing.playCount - 1) + avgFocus) / existing.playCount;
            existing.avgRelaxationScore = (existing.avgRelaxationScore * (existing.playCount - 1) + avgRelax) / existing.playCount;
            existing.avgStressLevel = (existing.avgStressLevel * (existing.playCount - 1) + avgStress) / existing.playCount;
            existing.avgHeartRate = (existing.avgHeartRate * (existing.playCount - 1) + avgHr) / existing.playCount;
          } else {
            songPerformanceMap.set(songId, {
              songId,
              title: ss.songs.title,
              artist: ss.songs.artist,
              tempo: ss.songs.tempo,
              energy: ss.songs.energy,
              valence: ss.songs.valence,
              avgFocusScore: avgFocus,
              avgRelaxationScore: avgRelax,
              avgStressLevel: avgStress,
              avgHeartRate: avgHr,
              playCount: 1,
              skipRate: ss.skipped ? 1 : 0,
              flowStateAchieved: avgFocus > 60 && avgRelax > 40 && avgStress < 40,
            });
          }
        });
      });

      const songsWithTempo = Array.from(songPerformanceMap.values()).filter((s) => s.tempo !== null);
      const flowSongs = songsWithTempo.filter((s) => s.flowStateAchieved);
      
      const bestTempoRange = flowSongs.length > 0
        ? { min: Math.min(...flowSongs.map((s) => s.tempo!)), max: Math.max(...flowSongs.map((s) => s.tempo!)) }
        : { min: 100, max: 140 };

      const songsWithEnergy = Array.from(songPerformanceMap.values()).filter((s) => s.energy !== null);
      const flowSongsEnergy = songsWithEnergy.filter((s) => s.flowStateAchieved);
      
      const bestEnergyRange = flowSongsEnergy.length > 0
        ? { min: Math.min(...flowSongsEnergy.map((s) => s.energy!)), max: Math.max(...flowSongsEnergy.map((s) => s.energy!)) }
        : { min: 0.4, max: 0.8 };

      const topSongs = Array.from(songPerformanceMap.values())
        .filter((s) => s.skipRate < 0.5)
        .sort((a, b) => b.avgFocusScore - a.avgFocusScore)
        .slice(0, 5);

      const avgFocusScore = activityBiometrics.length > 0
        ? activityBiometrics.reduce((sum: number, b: any) => sum + (b.focus_score || 0), 0) / activityBiometrics.length
        : 0;
      const avgRelaxation = activityBiometrics.length > 0
        ? activityBiometrics.reduce((sum: number, b: any) => sum + (b.relaxation_score || 0), 0) / activityBiometrics.length
        : 0;
      
      const recommendedBpm = activityName === "workout" ? 140 
        : activityName === "sleep" ? 60 
        : activityName === "study" ? 110 
        : activityName === "relax" ? 80 
        : 100;

      insights.push({
        activityId,
        activityName,
        totalSessions: activitySessions.length,
        avgSessionDuration: Math.round(avgDuration),
        bestTempoRange,
        bestEnergyRange,
        topSongs,
        avgFlowStateTime: flowSongs.length / (songsWithTempo.length || 1) * 100,
        avgFocusScore: Math.round(avgFocusScore),
        avgRelaxationScore: Math.round(avgRelaxation),
        avgStressReduction: 0,
        recommendedBpm,
      });
    });

    // Calculate overall insights
    const totalTime = sessions.reduce((sum, s) => {
      if (s.ended_at && s.started_at) {
        return sum + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime());
      }
      return sum;
    }, 0);

    const flowPercentage = insights.length > 0
      ? insights.reduce((sum, i) => sum + i.avgFlowStateTime, 0) / insights.length
      : 0;

    const sortedByFocus = [...insights].sort((a, b) => b.avgFocusScore - a.avgFocusScore);
    const sortedByRelax = [...insights].sort((a, b) => b.avgRelaxationScore - a.avgRelaxationScore);

    const overall: OverallInsights = {
      totalListeningTime: Math.round(totalTime / 60000),
      totalSessions: sessions.length,
      flowStatePercentage: Math.round(flowPercentage),
      mostProductiveActivity: sortedByFocus[0]?.activityName || "None",
      mostRelaxingActivity: sortedByRelax[0]?.activityName || "None",
      optimalHeartRateZone: { min: 65, max: 85 },
      peakFocusHours: [9, 10, 14, 15],
    };

    return { activityInsights: insights, overallInsights: overall };
  }, [sessions, biometrics]);

  const refreshAnalytics = useCallback(() => {
    refetchSessions();
    refetchBiometrics();
  }, [refetchSessions, refetchBiometrics]);

  return {
    activityInsights,
    overallInsights,
    isLoading: sessionsLoading || biometricsLoading,
    error: sessionsError?.message || null,
    refreshAnalytics,
  };
}

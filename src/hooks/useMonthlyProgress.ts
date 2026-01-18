import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WeekSummary {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  totalSessions: number;
  totalMinutes: number;
  avgFlowScore: number;
  avgFocusScore: number;
  avgRelaxationScore: number;
  topActivity: string;
  sessionsPerDay: number;
  peakDay: string;
  peakHour: number;
}

interface MusicPreferenceTrend {
  activity: string;
  weeks: {
    weekNumber: number;
    avgTempo: number;
    avgEnergy: number;
    avgValence: number;
    sessionCount: number;
  }[];
  overallTrend: {
    tempoDirection: "increasing" | "decreasing" | "stable";
    energyDirection: "increasing" | "decreasing" | "stable";
    valenceDirection: "increasing" | "decreasing" | "stable";
  };
}

interface FlowProgressMetric {
  metric: string;
  weeklyValues: number[];
  improvement: number;
  trend: "improving" | "declining" | "stable";
  bestWeek: number;
  currentWeek: number;
}

interface ActivityProgress {
  activity: string;
  sessionsOverTime: number[];
  flowScoresOverTime: number[];
  minutesOverTime: number[];
  improvement: number;
  mostImprovedMetric: string;
}

interface MonthlyMilestone {
  type: "streak" | "flow_peak" | "session_count" | "consistency" | "improvement";
  title: string;
  description: string;
  achievedAt: Date;
  value: number;
}

export interface MonthlyProgressData {
  weeklySummaries: WeekSummary[];
  musicPreferenceTrends: MusicPreferenceTrend[];
  flowProgress: FlowProgressMetric[];
  activityProgress: ActivityProgress[];
  milestones: MonthlyMilestone[];
  overallStats: {
    totalSessions: number;
    totalMinutes: number;
    avgFlowScore: number;
    flowImprovement: number;
    consistencyScore: number;
    activeDays: number;
    longestStreak: number;
    mostProductiveWeek: number;
    topActivity: string;
    bestFlowDay: string;
    bestFlowHour: number;
  };
  monthOverMonthComparison: {
    sessionsChange: number;
    minutesChange: number;
    flowChange: number;
    consistencyChange: number;
  } | null;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function useMonthlyProgress() {
  const [data, setData] = useState<MonthlyProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateProgress = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Not authenticated");
        setIsLoading(false);
        return;
      }

      // Fetch last 8 weeks of data (current month + previous month for comparison)
      const eightWeeksAgo = new Date();
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

      const { data: sessions, error: sessionsError } = await supabase
        .from("listening_sessions")
        .select(`
          *,
          activity_types(id, name)
        `)
        .eq("user_id", user.id)
        .gte("started_at", eightWeeksAgo.toISOString())
        .order("started_at", { ascending: true });

      if (sessionsError) throw sessionsError;

      const { data: biometrics } = await supabase
        .from("biometric_readings")
        .select("*")
        .eq("user_id", user.id)
        .gte("recorded_at", eightWeeksAgo.toISOString());

      const { data: sessionSongs } = await supabase
        .from("session_songs")
        .select(`
          *,
          songs(tempo, energy, valence, danceability)
        `)
        .in("session_id", sessions?.map(s => s.id) || []);

      // Calculate all insights
      const weeklySummaries = calculateWeeklySummaries(sessions || [], biometrics || []);
      const musicPreferenceTrends = calculateMusicPreferenceTrends(sessions || [], sessionSongs || []);
      const flowProgress = calculateFlowProgress(biometrics || [], weeklySummaries);
      const activityProgress = calculateActivityProgress(sessions || [], biometrics || []);
      const milestones = calculateMilestones(sessions || [], biometrics || [], weeklySummaries);
      const overallStats = calculateOverallStats(sessions || [], biometrics || [], weeklySummaries);
      const monthOverMonthComparison = calculateMonthComparison(weeklySummaries);

      setData({
        weeklySummaries: weeklySummaries.slice(-4), // Last 4 weeks only
        musicPreferenceTrends,
        flowProgress,
        activityProgress,
        milestones,
        overallStats,
        monthOverMonthComparison,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    calculateProgress();
  }, [calculateProgress]);

  return { data, isLoading, error, refresh: calculateProgress };
}

function getWeekNumber(date: Date): number {
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
  return 4 - Math.min(diffWeeks, 3); // Week 1-4, with 4 being the most recent
}

function calculateWeeklySummaries(sessions: any[], biometrics: any[]): WeekSummary[] {
  const weeklyData: Map<number, {
    sessions: any[];
    biometrics: any[];
    weekStart: Date;
    weekEnd: Date;
  }> = new Map();

  // Initialize 8 weeks
  for (let i = 0; i < 8; i++) {
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - (i * 7));
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    weeklyData.set(8 - i, { sessions: [], biometrics: [], weekStart, weekEnd });
  }

  // Group sessions by week
  sessions.forEach(session => {
    const sessionDate = new Date(session.started_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
    const weekNum = 8 - Math.floor(diffDays / 7);
    if (weekNum >= 1 && weekNum <= 8) {
      weeklyData.get(weekNum)?.sessions.push(session);
    }
  });

  // Group biometrics by week
  biometrics.forEach(reading => {
    const readingDate = new Date(reading.recorded_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - readingDate.getTime()) / (1000 * 60 * 60 * 24));
    const weekNum = 8 - Math.floor(diffDays / 7);
    if (weekNum >= 1 && weekNum <= 8) {
      weeklyData.get(weekNum)?.biometrics.push(reading);
    }
  });

  const summaries: WeekSummary[] = [];

  weeklyData.forEach((data, weekNum) => {
    const { sessions: weekSessions, biometrics: weekBiometrics, weekStart, weekEnd } = data;
    
    const totalMinutes = weekSessions.reduce((sum, s) => {
      if (s.ended_at) {
        const duration = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
        return sum + duration;
      }
      return sum;
    }, 0);

    const flowScores = weekBiometrics
      .filter(b => b.focus_score !== null && b.relaxation_score !== null)
      .map(b => (b.focus_score + b.relaxation_score) / 2);
    
    const focusScores = weekBiometrics.filter(b => b.focus_score !== null).map(b => b.focus_score);
    const relaxScores = weekBiometrics.filter(b => b.relaxation_score !== null).map(b => b.relaxation_score);

    // Find top activity
    const activityCounts: Record<string, number> = {};
    weekSessions.forEach(s => {
      const name = s.activity_types?.name || "Unknown";
      activityCounts[name] = (activityCounts[name] || 0) + 1;
    });
    const topActivity = Object.entries(activityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

    // Find peak day
    const dayCounts: Record<string, number> = {};
    weekSessions.forEach(s => {
      const day = DAYS[new Date(s.started_at).getDay()];
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

    // Find peak hour
    const hourCounts: Record<number, number> = {};
    weekSessions.forEach(s => {
      const hour = new Date(s.started_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peakHour = parseInt(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "9");

    summaries.push({
      weekNumber: weekNum,
      weekStart,
      weekEnd,
      totalSessions: weekSessions.length,
      totalMinutes: Math.round(totalMinutes),
      avgFlowScore: flowScores.length > 0 ? Math.round(flowScores.reduce((a, b) => a + b, 0) / flowScores.length) : 0,
      avgFocusScore: focusScores.length > 0 ? Math.round(focusScores.reduce((a, b) => a + b, 0) / focusScores.length) : 0,
      avgRelaxationScore: relaxScores.length > 0 ? Math.round(relaxScores.reduce((a, b) => a + b, 0) / relaxScores.length) : 0,
      topActivity,
      sessionsPerDay: weekSessions.length / 7,
      peakDay,
      peakHour,
    });
  });

  return summaries.sort((a, b) => a.weekNumber - b.weekNumber);
}

function calculateMusicPreferenceTrends(sessions: any[], sessionSongs: any[]): MusicPreferenceTrend[] {
  const activityWeeklyData: Map<string, Map<number, { tempos: number[]; energies: number[]; valences: number[] }>> = new Map();

  sessions.forEach(session => {
    const activityName = session.activity_types?.name || "Unknown";
    const sessionDate = new Date(session.started_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
    const weekNum = 4 - Math.floor(diffDays / 7);
    
    if (weekNum < 1 || weekNum > 4) return;

    if (!activityWeeklyData.has(activityName)) {
      activityWeeklyData.set(activityName, new Map());
    }

    const activityData = activityWeeklyData.get(activityName)!;
    if (!activityData.has(weekNum)) {
      activityData.set(weekNum, { tempos: [], energies: [], valences: [] });
    }

    const songsForSession = sessionSongs.filter(ss => ss.session_id === session.id);
    songsForSession.forEach(ss => {
      if (ss.songs?.tempo) activityData.get(weekNum)!.tempos.push(ss.songs.tempo);
      if (ss.songs?.energy) activityData.get(weekNum)!.energies.push(ss.songs.energy);
      if (ss.songs?.valence) activityData.get(weekNum)!.valences.push(ss.songs.valence);
    });
  });

  const trends: MusicPreferenceTrend[] = [];

  activityWeeklyData.forEach((weeklyData, activity) => {
    const weeks: MusicPreferenceTrend["weeks"] = [];
    
    for (let w = 1; w <= 4; w++) {
      const data = weeklyData.get(w);
      if (data) {
        weeks.push({
          weekNumber: w,
          avgTempo: data.tempos.length > 0 ? Math.round(data.tempos.reduce((a, b) => a + b, 0) / data.tempos.length) : 0,
          avgEnergy: data.energies.length > 0 ? Math.round((data.energies.reduce((a, b) => a + b, 0) / data.energies.length) * 100) : 0,
          avgValence: data.valences.length > 0 ? Math.round((data.valences.reduce((a, b) => a + b, 0) / data.valences.length) * 100) : 0,
          sessionCount: data.tempos.length,
        });
      } else {
        weeks.push({ weekNumber: w, avgTempo: 0, avgEnergy: 0, avgValence: 0, sessionCount: 0 });
      }
    }

    const validWeeks = weeks.filter(w => w.sessionCount > 0);
    const tempoTrend = calculateTrendDirection(validWeeks.map(w => w.avgTempo));
    const energyTrend = calculateTrendDirection(validWeeks.map(w => w.avgEnergy));
    const valenceTrend = calculateTrendDirection(validWeeks.map(w => w.avgValence));

    trends.push({
      activity,
      weeks,
      overallTrend: {
        tempoDirection: tempoTrend,
        energyDirection: energyTrend,
        valenceDirection: valenceTrend,
      },
    });
  });

  return trends;
}

function calculateTrendDirection(values: number[]): "increasing" | "decreasing" | "stable" {
  if (values.length < 2) return "stable";
  
  const firstHalf = values.slice(0, Math.ceil(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  const diff = secondAvg - firstAvg;
  const threshold = firstAvg * 0.1; // 10% change threshold
  
  if (diff > threshold) return "increasing";
  if (diff < -threshold) return "decreasing";
  return "stable";
}

function calculateFlowProgress(biometrics: any[], weeklySummaries: WeekSummary[]): FlowProgressMetric[] {
  const last4Weeks = weeklySummaries.slice(-4);
  
  const flowValues = last4Weeks.map(w => w.avgFlowScore);
  const focusValues = last4Weeks.map(w => w.avgFocusScore);
  const relaxValues = last4Weeks.map(w => w.avgRelaxationScore);

  const calculateMetric = (name: string, values: number[]): FlowProgressMetric => {
    const improvement = values.length >= 2 ? values[values.length - 1] - values[0] : 0;
    const bestWeek = values.indexOf(Math.max(...values)) + 1;
    
    return {
      metric: name,
      weeklyValues: values,
      improvement,
      trend: improvement > 5 ? "improving" : improvement < -5 ? "declining" : "stable",
      bestWeek,
      currentWeek: values[values.length - 1] || 0,
    };
  };

  return [
    calculateMetric("Flow Score", flowValues),
    calculateMetric("Focus Score", focusValues),
    calculateMetric("Relaxation Score", relaxValues),
  ];
}

function calculateActivityProgress(sessions: any[], biometrics: any[]): ActivityProgress[] {
  const activityData: Map<string, { sessions: any[]; biometrics: any[] }[]> = new Map();

  // Group by activity and week
  sessions.forEach(session => {
    const activityName = session.activity_types?.name || "Unknown";
    const sessionDate = new Date(session.started_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
    const weekIdx = 3 - Math.floor(diffDays / 7);
    
    if (weekIdx < 0 || weekIdx > 3) return;

    if (!activityData.has(activityName)) {
      activityData.set(activityName, [
        { sessions: [], biometrics: [] },
        { sessions: [], biometrics: [] },
        { sessions: [], biometrics: [] },
        { sessions: [], biometrics: [] },
      ]);
    }

    activityData.get(activityName)![weekIdx].sessions.push(session);

    // Add related biometrics
    const sessionBiometrics = biometrics.filter(b => b.session_id === session.id);
    activityData.get(activityName)![weekIdx].biometrics.push(...sessionBiometrics);
  });

  const progress: ActivityProgress[] = [];

  activityData.forEach((weeks, activity) => {
    const sessionsOverTime = weeks.map(w => w.sessions.length);
    const minutesOverTime = weeks.map(w => 
      w.sessions.reduce((sum, s) => {
        if (s.ended_at) {
          return sum + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
        }
        return sum;
      }, 0)
    );
    const flowScoresOverTime = weeks.map(w => {
      const flows = w.biometrics
        .filter(b => b.focus_score !== null && b.relaxation_score !== null)
        .map(b => (b.focus_score + b.relaxation_score) / 2);
      return flows.length > 0 ? Math.round(flows.reduce((a, b) => a + b, 0) / flows.length) : 0;
    });

    const sessionImprovement = sessionsOverTime[3] - sessionsOverTime[0];
    const flowImprovement = flowScoresOverTime[3] - flowScoresOverTime[0];
    const minutesImprovement = minutesOverTime[3] - minutesOverTime[0];

    const improvements = [
      { metric: "Session Count", value: sessionImprovement },
      { metric: "Flow Score", value: flowImprovement },
      { metric: "Duration", value: minutesImprovement },
    ];

    const mostImproved = improvements.sort((a, b) => b.value - a.value)[0];

    progress.push({
      activity,
      sessionsOverTime,
      flowScoresOverTime,
      minutesOverTime: minutesOverTime.map(m => Math.round(m)),
      improvement: flowImprovement,
      mostImprovedMetric: mostImproved.metric,
    });
  });

  return progress.sort((a, b) => b.improvement - a.improvement);
}

function calculateMilestones(sessions: any[], biometrics: any[], weeklySummaries: WeekSummary[]): MonthlyMilestone[] {
  const milestones: MonthlyMilestone[] = [];
  const last4Weeks = weeklySummaries.slice(-4);

  // Session count milestones
  const totalSessions = last4Weeks.reduce((sum, w) => sum + w.totalSessions, 0);
  if (totalSessions >= 30) {
    milestones.push({
      type: "session_count",
      title: "Session Master",
      description: `Completed ${totalSessions} sessions this month`,
      achievedAt: new Date(),
      value: totalSessions,
    });
  } else if (totalSessions >= 20) {
    milestones.push({
      type: "session_count",
      title: "Dedicated Listener",
      description: `Completed ${totalSessions} sessions this month`,
      achievedAt: new Date(),
      value: totalSessions,
    });
  } else if (totalSessions >= 10) {
    milestones.push({
      type: "session_count",
      title: "Getting Started",
      description: `Completed ${totalSessions} sessions this month`,
      achievedAt: new Date(),
      value: totalSessions,
    });
  }

  // Flow score improvement
  if (last4Weeks.length >= 2) {
    const firstWeekFlow = last4Weeks[0]?.avgFlowScore || 0;
    const lastWeekFlow = last4Weeks[last4Weeks.length - 1]?.avgFlowScore || 0;
    const improvement = lastWeekFlow - firstWeekFlow;

    if (improvement >= 20) {
      milestones.push({
        type: "improvement",
        title: "Flow Champion",
        description: `Improved flow score by ${improvement}% this month`,
        achievedAt: new Date(),
        value: improvement,
      });
    } else if (improvement >= 10) {
      milestones.push({
        type: "improvement",
        title: "Rising Star",
        description: `Improved flow score by ${improvement}% this month`,
        achievedAt: new Date(),
        value: improvement,
      });
    }
  }

  // Peak flow achievement
  const peakFlow = Math.max(...last4Weeks.map(w => w.avgFlowScore));
  if (peakFlow >= 80) {
    milestones.push({
      type: "flow_peak",
      title: "Peak Performance",
      description: `Achieved ${peakFlow}% flow score`,
      achievedAt: new Date(),
      value: peakFlow,
    });
  }

  // Consistency milestones
  const weeksWithSessions = last4Weeks.filter(w => w.totalSessions > 0).length;
  if (weeksWithSessions === 4) {
    milestones.push({
      type: "consistency",
      title: "Consistent Practice",
      description: "Active every week this month",
      achievedAt: new Date(),
      value: 4,
    });
  }

  return milestones;
}

function calculateOverallStats(sessions: any[], biometrics: any[], weeklySummaries: WeekSummary[]) {
  const last4Weeks = weeklySummaries.slice(-4);
  
  const totalSessions = last4Weeks.reduce((sum, w) => sum + w.totalSessions, 0);
  const totalMinutes = last4Weeks.reduce((sum, w) => sum + w.totalMinutes, 0);
  
  const flowScores = last4Weeks.filter(w => w.avgFlowScore > 0).map(w => w.avgFlowScore);
  const avgFlowScore = flowScores.length > 0 
    ? Math.round(flowScores.reduce((a, b) => a + b, 0) / flowScores.length) 
    : 0;

  const flowImprovement = last4Weeks.length >= 2 
    ? (last4Weeks[last4Weeks.length - 1]?.avgFlowScore || 0) - (last4Weeks[0]?.avgFlowScore || 0)
    : 0;

  // Calculate consistency (sessions per week variance)
  const sessionsPerWeek = last4Weeks.map(w => w.totalSessions);
  const avgSessionsPerWeek = sessionsPerWeek.reduce((a, b) => a + b, 0) / sessionsPerWeek.length;
  const variance = sessionsPerWeek.reduce((sum, s) => sum + Math.pow(s - avgSessionsPerWeek, 2), 0) / sessionsPerWeek.length;
  const consistencyScore = Math.max(0, 100 - (variance * 10)); // Lower variance = higher consistency

  // Count active days
  const activeDates = new Set(
    sessions
      .filter(s => {
        const date = new Date(s.started_at);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 28;
      })
      .map(s => new Date(s.started_at).toDateString())
  );

  // Calculate longest streak
  let longestStreak = 0;
  let currentStreak = 0;
  for (let i = 0; i < 28; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    if (activeDates.has(date.toDateString())) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  // Find most productive week
  const mostProductiveWeek = last4Weeks.reduce((best, week) => 
    week.avgFlowScore > (best?.avgFlowScore || 0) ? week : best
  , last4Weeks[0])?.weekNumber || 1;

  // Find top activity across month
  const activityCounts: Record<string, number> = {};
  sessions.forEach(s => {
    const date = new Date(s.started_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 28) {
      const name = s.activity_types?.name || "Unknown";
      activityCounts[name] = (activityCounts[name] || 0) + 1;
    }
  });
  const topActivity = Object.entries(activityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

  // Find best flow day and hour
  const dayFlowScores: Record<string, number[]> = {};
  const hourFlowScores: Record<number, number[]> = {};
  
  biometrics.forEach(b => {
    const date = new Date(b.recorded_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 28 && b.focus_score !== null && b.relaxation_score !== null) {
      const flow = (b.focus_score + b.relaxation_score) / 2;
      const day = DAYS[date.getDay()];
      const hour = date.getHours();
      
      if (!dayFlowScores[day]) dayFlowScores[day] = [];
      dayFlowScores[day].push(flow);
      
      if (!hourFlowScores[hour]) hourFlowScores[hour] = [];
      hourFlowScores[hour].push(flow);
    }
  });

  const bestFlowDay = Object.entries(dayFlowScores)
    .map(([day, scores]) => ({ day, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
    .sort((a, b) => b.avg - a.avg)[0]?.day || "Monday";

  const bestFlowHour = Object.entries(hourFlowScores)
    .map(([hour, scores]) => ({ hour: parseInt(hour), avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
    .sort((a, b) => b.avg - a.avg)[0]?.hour || 9;

  return {
    totalSessions,
    totalMinutes: Math.round(totalMinutes),
    avgFlowScore,
    flowImprovement: Math.round(flowImprovement),
    consistencyScore: Math.round(consistencyScore),
    activeDays: activeDates.size,
    longestStreak,
    mostProductiveWeek,
    topActivity,
    bestFlowDay,
    bestFlowHour,
  };
}

function calculateMonthComparison(weeklySummaries: WeekSummary[]) {
  if (weeklySummaries.length < 8) return null;

  const currentMonth = weeklySummaries.slice(-4);
  const previousMonth = weeklySummaries.slice(0, 4);

  const currentSessions = currentMonth.reduce((sum, w) => sum + w.totalSessions, 0);
  const previousSessions = previousMonth.reduce((sum, w) => sum + w.totalSessions, 0);

  const currentMinutes = currentMonth.reduce((sum, w) => sum + w.totalMinutes, 0);
  const previousMinutes = previousMonth.reduce((sum, w) => sum + w.totalMinutes, 0);

  const currentFlow = currentMonth.filter(w => w.avgFlowScore > 0);
  const previousFlow = previousMonth.filter(w => w.avgFlowScore > 0);

  const currentAvgFlow = currentFlow.length > 0 
    ? currentFlow.reduce((sum, w) => sum + w.avgFlowScore, 0) / currentFlow.length 
    : 0;
  const previousAvgFlow = previousFlow.length > 0 
    ? previousFlow.reduce((sum, w) => sum + w.avgFlowScore, 0) / previousFlow.length 
    : 0;

  // Consistency based on sessions per week variance
  const calcConsistency = (weeks: WeekSummary[]) => {
    const sessions = weeks.map(w => w.totalSessions);
    const avg = sessions.reduce((a, b) => a + b, 0) / sessions.length;
    const variance = sessions.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / sessions.length;
    return Math.max(0, 100 - (variance * 10));
  };

  return {
    sessionsChange: previousSessions > 0 ? Math.round(((currentSessions - previousSessions) / previousSessions) * 100) : 0,
    minutesChange: previousMinutes > 0 ? Math.round(((currentMinutes - previousMinutes) / previousMinutes) * 100) : 0,
    flowChange: Math.round(currentAvgFlow - previousAvgFlow),
    consistencyChange: Math.round(calcConsistency(currentMonth) - calcConsistency(previousMonth)),
  };
}

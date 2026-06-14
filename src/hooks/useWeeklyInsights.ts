import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DayPattern {
  day: string;
  dayIndex: number;
  totalSessions: number;
  totalMinutes: number;
  avgFlowScore: number;
  avgFocusScore: number;
  avgRelaxationScore: number;
  peakHour: number;
  peakFlowScore: number;
  optimalTempo: number;
  optimalEnergy: number;
  activities: { name: string; count: number; avgFlow: number }[];
}

interface HourPattern {
  hour: number;
  label: string;
  sessionCount: number;
  avgFlowScore: number;
  avgFocusScore: number;
  avgStress: number;
  optimalForActivities: string[];
}

interface WeeklyTrend {
  weekStart: string;
  weekEnd: string;
  totalSessions: number;
  totalMinutes: number;
  avgFlowScore: number;
  flowImprovement: number;
  mostProductiveDay: string;
  mostProductiveHour: number;
  topActivity: string;
}

interface MusicTimingInsight {
  activityName: string;
  bestDays: string[];
  bestHours: number[];
  avgSessionDuration: number;
  optimalTempo: { min: number; max: number };
  optimalEnergy: { min: number; max: number };
  flowAchievementRate: number;
}

export interface WeeklyInsightsData {
  dayPatterns: DayPattern[];
  hourPatterns: HourPattern[];
  currentWeekTrend: WeeklyTrend | null;
  previousWeekTrend: WeeklyTrend | null;
  musicTimingInsights: MusicTimingInsight[];
  overallStats: {
    totalSessionsThisWeek: number;
    totalMinutesThisWeek: number;
    avgFlowScoreThisWeek: number;
    weekOverWeekChange: number;
    streakDays: number;
    mostActiveDay: string;
    leastActiveDay: string;
  };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function useWeeklyInsights() {
  const [data, setData] = useState<WeeklyInsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Not authenticated");
        setIsLoading(false);
        return;
      }

      // Fetch last 4 weeks of data
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      const { data: sessions, error: sessionsError } = await supabase
        .from("listening_sessions")
        .select(`
          *,
          activity_types(id, name)
        `)
        .eq("user_id", user.id)
        .gte("started_at", fourWeeksAgo.toISOString())
        .order("started_at", { ascending: true });

      if (sessionsError) throw sessionsError;

      const { data: biometrics } = await supabase
        .from("biometric_readings")
        .select("*")
        .eq("user_id", user.id)
        .gte("recorded_at", fourWeeksAgo.toISOString());

      const { data: sessionSongs } = await supabase
        .from("session_songs")
        .select(`
          *,
          songs(tempo, energy, valence)
        `)
        .in("session_id", sessions?.map(s => s.id) || []);

      // Calculate day patterns
      const dayPatterns = calculateDayPatterns(sessions || [], biometrics || [], sessionSongs || []);
      
      // Calculate hour patterns
      const hourPatterns = calculateHourPatterns(sessions || [], biometrics || []);
      
      // Calculate weekly trends
      const { currentWeek, previousWeek } = calculateWeeklyTrends(sessions || [], biometrics || []);
      
      // Calculate music timing insights
      const musicTimingInsights = calculateMusicTimingInsights(sessions || [], biometrics || [], sessionSongs || []);
      
      // Calculate overall stats
      const overallStats = calculateOverallStats(sessions || [], biometrics || [], dayPatterns);

      setData({
        dayPatterns,
        hourPatterns,
        currentWeekTrend: currentWeek,
        previousWeekTrend: previousWeek,
        musicTimingInsights,
        overallStats,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    calculateInsights();
  }, [calculateInsights]);

  return { data, isLoading, error, refresh: calculateInsights };
}

function calculateDayPatterns(
  sessions: any[],
  biometrics: any[],
  sessionSongs: any[]
): DayPattern[] {
  const dayData: Map<number, {
    sessions: any[];
    biometrics: any[];
    songs: any[];
    hourlyFlow: Map<number, number[]>;
  }> = new Map();

  // Initialize all days
  for (let i = 0; i < 7; i++) {
    dayData.set(i, { sessions: [], biometrics: [], songs: [], hourlyFlow: new Map() });
  }

  // Group sessions by day of week
  sessions.forEach(session => {
    const date = new Date(session.started_at);
    const dayIndex = date.getDay();
    const hour = date.getHours();
    const data = dayData.get(dayIndex)!;
    data.sessions.push(session);

    // Track flow by hour
    const sessionBio = biometrics.filter(b => b.session_id === session.id);
    if (sessionBio.length > 0) {
      const avgFlow = sessionBio.reduce((sum, b) => sum + (b.focus_score || 0), 0) / sessionBio.length;
      if (!data.hourlyFlow.has(hour)) {
        data.hourlyFlow.set(hour, []);
      }
      data.hourlyFlow.get(hour)!.push(avgFlow);
    }
  });

  // Group biometrics by day
  biometrics.forEach(bio => {
    const date = new Date(bio.recorded_at);
    const dayIndex = date.getDay();
    dayData.get(dayIndex)!.biometrics.push(bio);
  });

  // Group songs by session's day
  sessionSongs.forEach(ss => {
    const session = sessions.find(s => s.id === ss.session_id);
    if (session) {
      const date = new Date(session.started_at);
      const dayIndex = date.getDay();
      dayData.get(dayIndex)!.songs.push(ss);
    }
  });

  return Array.from(dayData.entries()).map(([dayIndex, data]) => {
    const totalMinutes = data.sessions.reduce((sum, s) => {
      if (s.ended_at && s.started_at) {
        return sum + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
      }
      return sum;
    }, 0);

    const avgFlowScore = data.biometrics.length > 0
      ? data.biometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / data.biometrics.length
      : 0;

    const avgFocusScore = data.biometrics.length > 0
      ? data.biometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / data.biometrics.length
      : 0;

    const avgRelaxationScore = data.biometrics.length > 0
      ? data.biometrics.reduce((sum, b) => sum + (b.relaxation_score || 0), 0) / data.biometrics.length
      : 0;

    // Find peak hour
    let peakHour = 9;
    let peakFlowScore = 0;
    data.hourlyFlow.forEach((scores, hour) => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg > peakFlowScore) {
        peakFlowScore = avg;
        peakHour = hour;
      }
    });

    // Calculate optimal tempo/energy
    const songsWithData = data.songs.filter(s => s.songs?.tempo && s.songs?.energy);
    const optimalTempo = songsWithData.length > 0
      ? songsWithData.reduce((sum, s) => sum + s.songs.tempo, 0) / songsWithData.length
      : 120;
    const optimalEnergy = songsWithData.length > 0
      ? songsWithData.reduce((sum, s) => sum + s.songs.energy, 0) / songsWithData.length
      : 0.5;

    // Activity breakdown
    const activityCounts: Map<string, { count: number; flowScores: number[] }> = new Map();
    data.sessions.forEach(s => {
      const name = s.activity_types?.name || "Unknown";
      if (!activityCounts.has(name)) {
        activityCounts.set(name, { count: 0, flowScores: [] });
      }
      const entry = activityCounts.get(name)!;
      entry.count++;
      const sessionBio = data.biometrics.filter(b => b.session_id === s.id);
      if (sessionBio.length > 0) {
        entry.flowScores.push(
          sessionBio.reduce((sum, b) => sum + (b.focus_score || 0), 0) / sessionBio.length
        );
      }
    });

    const activities = Array.from(activityCounts.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      avgFlow: data.flowScores.length > 0
        ? data.flowScores.reduce((a, b) => a + b, 0) / data.flowScores.length
        : 0,
    }));

    return {
      day: SHORT_DAYS[dayIndex],
      dayIndex,
      totalSessions: data.sessions.length,
      totalMinutes: Math.round(totalMinutes),
      avgFlowScore: Math.round(avgFlowScore),
      avgFocusScore: Math.round(avgFocusScore),
      avgRelaxationScore: Math.round(avgRelaxationScore),
      peakHour,
      peakFlowScore: Math.round(peakFlowScore),
      optimalTempo: Math.round(optimalTempo),
      optimalEnergy: Math.round(optimalEnergy * 100),
      activities,
    };
  });
}

function calculateHourPatterns(sessions: any[], biometrics: any[]): HourPattern[] {
  const hourData: Map<number, {
    sessions: any[];
    biometrics: any[];
    activities: Set<string>;
  }> = new Map();

  // Initialize all hours
  for (let i = 0; i < 24; i++) {
    hourData.set(i, { sessions: [], biometrics: [], activities: new Set() });
  }

  sessions.forEach(session => {
    const hour = new Date(session.started_at).getHours();
    const data = hourData.get(hour)!;
    data.sessions.push(session);
    if (session.activity_types?.name) {
      data.activities.add(session.activity_types.name);
    }
  });

  biometrics.forEach(bio => {
    const hour = new Date(bio.recorded_at).getHours();
    hourData.get(hour)!.biometrics.push(bio);
  });

  return Array.from(hourData.entries()).map(([hour, data]) => {
    const avgFlowScore = data.biometrics.length > 0
      ? data.biometrics.reduce((sum, b) => sum + ((b.focus_score || 0) * 0.6 + (b.relaxation_score || 0) * 0.4 - (b.stress_level || 0) * 0.2), 0) / data.biometrics.length
      : 0;

    const avgFocusScore = data.biometrics.length > 0
      ? data.biometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / data.biometrics.length
      : 0;

    const avgStress = data.biometrics.length > 0
      ? data.biometrics.reduce((sum, b) => sum + (b.stress_level || 0), 0) / data.biometrics.length
      : 0;

    return {
      hour,
      label: `${hour.toString().padStart(2, "0")}:00`,
      sessionCount: data.sessions.length,
      avgFlowScore: Math.round(avgFlowScore),
      avgFocusScore: Math.round(avgFocusScore),
      avgStress: Math.round(avgStress),
      optimalForActivities: Array.from(data.activities),
    };
  });
}

function calculateWeeklyTrends(sessions: any[], biometrics: any[]): {
  currentWeek: WeeklyTrend | null;
  previousWeek: WeeklyTrend | null;
} {
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay());
  currentWeekStart.setHours(0, 0, 0, 0);

  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);

  const calculateTrend = (start: Date, end: Date): WeeklyTrend | null => {
    const weekSessions = sessions.filter(s => {
      const date = new Date(s.started_at);
      return date >= start && date < end;
    });

    if (weekSessions.length === 0) return null;

    const weekBiometrics = biometrics.filter(b => {
      const date = new Date(b.recorded_at);
      return date >= start && date < end;
    });

    const totalMinutes = weekSessions.reduce((sum, s) => {
      if (s.ended_at && s.started_at) {
        return sum + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
      }
      return sum;
    }, 0);

    const avgFlowScore = weekBiometrics.length > 0
      ? weekBiometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / weekBiometrics.length
      : 0;

    // Find most productive day
    const dayScores: Map<number, number[]> = new Map();
    weekSessions.forEach(s => {
      const dayIndex = new Date(s.started_at).getDay();
      const sessionBio = weekBiometrics.filter(b => b.session_id === s.id);
      if (sessionBio.length > 0) {
        const avg = sessionBio.reduce((sum, b) => sum + (b.focus_score || 0), 0) / sessionBio.length;
        if (!dayScores.has(dayIndex)) dayScores.set(dayIndex, []);
        dayScores.get(dayIndex)!.push(avg);
      }
    });

    let mostProductiveDay = DAYS[0];
    let highestAvg = 0;
    dayScores.forEach((scores, dayIndex) => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg > highestAvg) {
        highestAvg = avg;
        mostProductiveDay = DAYS[dayIndex];
      }
    });

    // Find most productive hour
    const hourScores: Map<number, number[]> = new Map();
    weekBiometrics.forEach(b => {
      const hour = new Date(b.recorded_at).getHours();
      if (!hourScores.has(hour)) hourScores.set(hour, []);
      hourScores.get(hour)!.push(b.focus_score || 0);
    });

    let mostProductiveHour = 9;
    let highestHourAvg = 0;
    hourScores.forEach((scores, hour) => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg > highestHourAvg) {
        highestHourAvg = avg;
        mostProductiveHour = hour;
      }
    });

    // Find top activity
    const activityCounts: Map<string, number> = new Map();
    weekSessions.forEach(s => {
      const name = s.activity_types?.name || "Unknown";
      activityCounts.set(name, (activityCounts.get(name) || 0) + 1);
    });
    let topActivity = "Unknown";
    let maxCount = 0;
    activityCounts.forEach((count, name) => {
      if (count > maxCount) {
        maxCount = count;
        topActivity = name;
      }
    });

    return {
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      totalSessions: weekSessions.length,
      totalMinutes: Math.round(totalMinutes),
      avgFlowScore: Math.round(avgFlowScore),
      flowImprovement: 0,
      mostProductiveDay,
      mostProductiveHour,
      topActivity,
    };
  };

  const currentWeek = calculateTrend(currentWeekStart, now);
  const previousWeek = calculateTrend(previousWeekStart, currentWeekStart);

  if (currentWeek && previousWeek && previousWeek.avgFlowScore > 0) {
    currentWeek.flowImprovement = Math.round(
      ((currentWeek.avgFlowScore - previousWeek.avgFlowScore) / previousWeek.avgFlowScore) * 100
    );
  }

  return { currentWeek, previousWeek };
}

function calculateMusicTimingInsights(
  sessions: any[],
  biometrics: any[],
  sessionSongs: any[]
): MusicTimingInsight[] {
  const activityData: Map<string, {
    days: Map<number, number>;
    hours: Map<number, number>;
    durations: number[];
    tempos: number[];
    energies: number[];
    flowAchieved: number;
    totalSessions: number;
  }> = new Map();

  sessions.forEach(session => {
    const activityName = session.activity_types?.name || "Unknown";
    if (!activityData.has(activityName)) {
      activityData.set(activityName, {
        days: new Map(),
        hours: new Map(),
        durations: [],
        tempos: [],
        energies: [],
        flowAchieved: 0,
        totalSessions: 0,
      });
    }

    const data = activityData.get(activityName)!;
    data.totalSessions++;

    const date = new Date(session.started_at);
    const dayIndex = date.getDay();
    const hour = date.getHours();

    data.days.set(dayIndex, (data.days.get(dayIndex) || 0) + 1);
    data.hours.set(hour, (data.hours.get(hour) || 0) + 1);

    if (session.ended_at && session.started_at) {
      data.durations.push(
        (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000
      );
    }

    // Check flow achievement
    const sessionBio = biometrics.filter(b => b.session_id === session.id);
    if (sessionBio.length > 0) {
      const avgFlow = sessionBio.reduce((sum, b) => sum + (b.focus_score || 0), 0) / sessionBio.length;
      if (avgFlow >= 70) data.flowAchieved++;
    }

    // Collect tempo/energy from songs
    const songs = sessionSongs.filter(ss => ss.session_id === session.id);
    songs.forEach(ss => {
      if (ss.songs?.tempo) data.tempos.push(ss.songs.tempo);
      if (ss.songs?.energy) data.energies.push(ss.songs.energy);
    });
  });

  return Array.from(activityData.entries()).map(([activityName, data]) => {
    // Find best days (top 3)
    const sortedDays = Array.from(data.days.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([dayIndex]) => SHORT_DAYS[dayIndex]);

    // Find best hours (top 3)
    const sortedHours = Array.from(data.hours.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => hour);

    const avgDuration = data.durations.length > 0
      ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
      : 0;

    const tempoMin = data.tempos.length > 0 ? Math.min(...data.tempos) : 100;
    const tempoMax = data.tempos.length > 0 ? Math.max(...data.tempos) : 140;
    const energyMin = data.energies.length > 0 ? Math.min(...data.energies) : 0.3;
    const energyMax = data.energies.length > 0 ? Math.max(...data.energies) : 0.7;

    return {
      activityName,
      bestDays: sortedDays,
      bestHours: sortedHours,
      avgSessionDuration: Math.round(avgDuration),
      optimalTempo: { min: Math.round(tempoMin), max: Math.round(tempoMax) },
      optimalEnergy: { min: Math.round(energyMin * 100), max: Math.round(energyMax * 100) },
      flowAchievementRate: data.totalSessions > 0
        ? Math.round((data.flowAchieved / data.totalSessions) * 100)
        : 0,
    };
  });
}

function calculateOverallStats(
  sessions: any[],
  biometrics: any[],
  dayPatterns: DayPattern[]
): WeeklyInsightsData["overallStats"] {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const thisWeekSessions = sessions.filter(s => new Date(s.started_at) >= weekStart);
  const thisWeekBiometrics = biometrics.filter(b => new Date(b.recorded_at) >= weekStart);

  const totalMinutes = thisWeekSessions.reduce((sum, s) => {
    if (s.ended_at && s.started_at) {
      return sum + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
    }
    return sum;
  }, 0);

  const avgFlowScore = thisWeekBiometrics.length > 0
    ? thisWeekBiometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / thisWeekBiometrics.length
    : 0;

  // Calculate streak
  let streakDays = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 30; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const hasSession = sessions.some(s => {
      const sessionDate = new Date(s.started_at);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate.getTime() === checkDate.getTime();
    });
    if (hasSession) {
      streakDays++;
    } else if (i > 0) {
      break;
    }
  }

  // Find most/least active days
  const sortedDays = [...dayPatterns].sort((a, b) => b.totalSessions - a.totalSessions);
  const mostActiveDay = sortedDays[0]?.day || "N/A";
  const leastActiveDay = sortedDays[sortedDays.length - 1]?.day || "N/A";

  // Week over week change
  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekBiometrics = biometrics.filter(b => {
    const date = new Date(b.recorded_at);
    return date >= previousWeekStart && date < weekStart;
  });
  const previousAvgFlow = previousWeekBiometrics.length > 0
    ? previousWeekBiometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / previousWeekBiometrics.length
    : 0;

  const weekOverWeekChange = previousAvgFlow > 0
    ? Math.round(((avgFlowScore - previousAvgFlow) / previousAvgFlow) * 100)
    : 0;

  return {
    totalSessionsThisWeek: thisWeekSessions.length,
    totalMinutesThisWeek: Math.round(totalMinutes),
    avgFlowScoreThisWeek: Math.round(avgFlowScore),
    weekOverWeekChange,
    streakDays,
    mostActiveDay,
    leastActiveDay,
  };
}

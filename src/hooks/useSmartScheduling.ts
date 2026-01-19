import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, subWeeks, format, addDays, setHours, setMinutes, isAfter, isBefore, addHours } from "date-fns";

interface ScheduleSuggestion {
  id: string;
  activityName: string;
  activityIcon: string;
  suggestedDay: string;
  suggestedDate: Date;
  suggestedHour: number;
  confidence: number;
  reasoning: string;
  historicalFlowScore: number;
  optimalTempo: { min: number; max: number };
  optimalEnergy: { min: number; max: number };
  expectedDuration: number;
}

interface ActivityOptimalWindow {
  activityName: string;
  activityIcon: string;
  bestDays: { day: string; dayIndex: number; score: number }[];
  bestHours: { hour: number; score: number }[];
  avgFlowScore: number;
  avgSessionDuration: number;
  successRate: number;
}

interface SmartSchedulingData {
  suggestions: ScheduleSuggestion[];
  activityWindows: ActivityOptimalWindow[];
  nextOptimalSlot: ScheduleSuggestion | null;
  weeklySchedule: { day: string; slots: ScheduleSuggestion[] }[];
}

export function useSmartScheduling() {
  const [data, setData] = useState<SmartSchedulingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const calculateScheduling = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const now = new Date();
      const fourWeeksAgo = subWeeks(now, 4);

      // Fetch historical data
      const [sessionsRes, biometricsRes, activityTypesRes] = await Promise.all([
        supabase
          .from("listening_sessions")
          .select("*, activity_types(name, icon)")
          .gte("started_at", fourWeeksAgo.toISOString())
          .order("started_at", { ascending: false }),
        supabase
          .from("biometric_readings")
          .select("*")
          .gte("recorded_at", fourWeeksAgo.toISOString()),
        supabase
          .from("activity_types")
          .select("*"),
      ]);

      const sessions = sessionsRes.data || [];
      const biometrics = biometricsRes.data || [];
      const activityTypes = activityTypesRes.data || [];

      // Calculate optimal windows per activity
      const activityWindows = calculateActivityWindows(sessions, biometrics, activityTypes);
      
      // Generate scheduling suggestions
      const suggestions = generateSuggestions(activityWindows, sessions, now);
      
      // Find next optimal slot
      const nextOptimalSlot = findNextOptimalSlot(suggestions, now);
      
      // Organize weekly schedule
      const weeklySchedule = organizeWeeklySchedule(suggestions);

      setData({
        suggestions,
        activityWindows,
        nextOptimalSlot,
        weeklySchedule,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to calculate scheduling"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    calculateScheduling();
  }, [calculateScheduling]);

  return { data, isLoading, error, refresh: calculateScheduling };
}

function calculateActivityWindows(
  sessions: any[],
  biometrics: any[],
  activityTypes: any[]
): ActivityOptimalWindow[] {
  const activityData: Map<string, {
    icon: string;
    dayScores: Map<number, { total: number; count: number }>;
    hourScores: Map<number, { total: number; count: number }>;
    durations: number[];
    flowScores: number[];
    successCount: number;
    totalCount: number;
  }> = new Map();

  // Initialize with all activity types
  activityTypes.forEach(at => {
    activityData.set(at.name, {
      icon: at.icon || "🎵",
      dayScores: new Map(),
      hourScores: new Map(),
      durations: [],
      flowScores: [],
      successCount: 0,
      totalCount: 0,
    });
  });

  // Process sessions
  sessions.forEach(session => {
    const activityName = session.activity_types?.name;
    if (!activityName || !activityData.has(activityName)) return;

    const data = activityData.get(activityName)!;
    const startDate = new Date(session.started_at);
    const dayIndex = startDate.getDay();
    const hour = startDate.getHours();

    // Get session biometrics
    const sessionBiometrics = biometrics.filter(b => b.session_id === session.id);
    const avgFlow = sessionBiometrics.length > 0
      ? sessionBiometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / sessionBiometrics.length
      : 50;

    // Update day scores
    const dayScore = data.dayScores.get(dayIndex) || { total: 0, count: 0 };
    dayScore.total += avgFlow;
    dayScore.count++;
    data.dayScores.set(dayIndex, dayScore);

    // Update hour scores
    const hourScore = data.hourScores.get(hour) || { total: 0, count: 0 };
    hourScore.total += avgFlow;
    hourScore.count++;
    data.hourScores.set(hour, hourScore);

    // Calculate duration
    if (session.ended_at) {
      const duration = (new Date(session.ended_at).getTime() - startDate.getTime()) / 60000;
      if (duration > 0 && duration < 480) { // Max 8 hours
        data.durations.push(duration);
      }
    }

    data.flowScores.push(avgFlow);
    data.totalCount++;
    if (avgFlow >= 70) data.successCount++;
  });

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return Array.from(activityData.entries())
    .filter(([_, data]) => data.totalCount > 0)
    .map(([name, data]) => {
      // Calculate best days
      const bestDays = Array.from(data.dayScores.entries())
        .map(([dayIndex, score]) => ({
          day: dayNames[dayIndex],
          dayIndex,
          score: score.count > 0 ? score.total / score.count : 0,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      // Calculate best hours
      const bestHours = Array.from(data.hourScores.entries())
        .map(([hour, score]) => ({
          hour,
          score: score.count > 0 ? score.total / score.count : 0,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      return {
        activityName: name,
        activityIcon: data.icon,
        bestDays,
        bestHours,
        avgFlowScore: data.flowScores.length > 0
          ? data.flowScores.reduce((a, b) => a + b, 0) / data.flowScores.length
          : 0,
        avgSessionDuration: data.durations.length > 0
          ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
          : 30,
        successRate: data.totalCount > 0 ? data.successCount / data.totalCount : 0,
      };
    });
}

function generateSuggestions(
  activityWindows: ActivityOptimalWindow[],
  sessions: any[],
  now: Date
): ScheduleSuggestion[] {
  const suggestions: ScheduleSuggestion[] = [];
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 });
  
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  activityWindows.forEach(activity => {
    if (activity.bestDays.length === 0 || activity.bestHours.length === 0) return;

    // Generate suggestions for each best day/hour combination
    activity.bestDays.slice(0, 2).forEach(dayInfo => {
      activity.bestHours.slice(0, 2).forEach(hourInfo => {
        // Calculate the date for this suggestion
        const suggestedDate = setMinutes(
          setHours(addDays(currentWeekStart, dayInfo.dayIndex), hourInfo.hour),
          0
        );

        // Skip if in the past
        if (isBefore(suggestedDate, now)) {
          // Try next week
          const nextWeekDate = addDays(suggestedDate, 7);
          if (isAfter(nextWeekDate, now)) {
            const confidence = calculateConfidence(dayInfo.score, hourInfo.score, activity.successRate);
            suggestions.push(createSuggestion(
              activity,
              dayInfo,
              hourInfo,
              nextWeekDate,
              confidence,
              sessions
            ));
          }
        } else {
          const confidence = calculateConfidence(dayInfo.score, hourInfo.score, activity.successRate);
          suggestions.push(createSuggestion(
            activity,
            dayInfo,
            hourInfo,
            suggestedDate,
            confidence,
            sessions
          ));
        }
      });
    });
  });

  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);
}

function createSuggestion(
  activity: ActivityOptimalWindow,
  dayInfo: { day: string; dayIndex: number; score: number },
  hourInfo: { hour: number; score: number },
  suggestedDate: Date,
  confidence: number,
  sessions: any[]
): ScheduleSuggestion {
  // Calculate optimal tempo/energy from sessions
  const activitySessions = sessions.filter(s => s.activity_types?.name === activity.activityName);
  
  return {
    id: `${activity.activityName}-${dayInfo.dayIndex}-${hourInfo.hour}`,
    activityName: activity.activityName,
    activityIcon: activity.activityIcon,
    suggestedDay: dayInfo.day,
    suggestedDate,
    suggestedHour: hourInfo.hour,
    confidence,
    reasoning: generateReasoning(activity, dayInfo, hourInfo),
    historicalFlowScore: Math.round(activity.avgFlowScore),
    optimalTempo: { min: 100, max: 140 },
    optimalEnergy: { min: 0.5, max: 0.8 },
    expectedDuration: Math.round(activity.avgSessionDuration),
  };
}

function calculateConfidence(dayScore: number, hourScore: number, successRate: number): number {
  const avgScore = (dayScore + hourScore) / 2;
  const successBonus = successRate * 20;
  return Math.min(Math.round((avgScore / 100) * 80 + successBonus), 100);
}

function generateReasoning(
  activity: ActivityOptimalWindow,
  dayInfo: { day: string; score: number },
  hourInfo: { hour: number; score: number }
): string {
  const hourLabel = hourInfo.hour < 12 
    ? `${hourInfo.hour}am` 
    : hourInfo.hour === 12 
      ? "12pm" 
      : `${hourInfo.hour - 12}pm`;

  const flowLevel = activity.avgFlowScore >= 75 ? "excellent" : activity.avgFlowScore >= 60 ? "good" : "moderate";
  
  return `Based on ${Math.round(activity.successRate * 100)}% flow success rate, ${dayInfo.day}s around ${hourLabel} show ${flowLevel} performance for ${activity.activityName.toLowerCase()}.`;
}

function findNextOptimalSlot(
  suggestions: ScheduleSuggestion[],
  now: Date
): ScheduleSuggestion | null {
  const futureSuggestions = suggestions
    .filter(s => isAfter(s.suggestedDate, now))
    .sort((a, b) => a.suggestedDate.getTime() - b.suggestedDate.getTime());

  return futureSuggestions[0] || null;
}

function organizeWeeklySchedule(
  suggestions: ScheduleSuggestion[]
): { day: string; slots: ScheduleSuggestion[] }[] {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  return dayNames.map(day => ({
    day,
    slots: suggestions
      .filter(s => s.suggestedDay === day)
      .sort((a, b) => a.suggestedHour - b.suggestedHour),
  }));
}

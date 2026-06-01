import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthReady } from "@/hooks/useAuthReady";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Heart,
  Brain,
  Music,
  TrendingUp,
  BarChart3,
  Activity,
  Moon,
  Dumbbell,
  BookOpen,
  Coffee,
  Car,
  Sparkles,
  Smile,
  Meh,
  Frown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, subDays } from "date-fns";
import { SessionExportButton } from "@/components/dashboard/SessionExportButton";
import { ChartSkeleton } from "@/components/skeletons/ListSkeleton";
import { EmptyState } from "@/components/EmptyState";

interface Session {
  id: string;
  name: string | null;
  started_at: string;
  ended_at: string | null;
  mood_before: string | null;
  mood_after: string | null;
  notes: string | null;
  activity_types: {
    id: string;
    name: string;
  } | null;
  session_songs?: { id: string }[];
}

interface BiometricReading {
  id: string;
  session_id: string | null;
  heart_rate: number | null;
  stress_level: number | null;
  focus_score: number | null;
  relaxation_score: number | null;
  eeg_alpha: number | null;
  eeg_beta: number | null;
  eeg_theta: number | null;
  eeg_gamma: number | null;
  eeg_delta: number | null;
  recorded_at: string;
}

interface SessionWithBiometrics extends Session {
  biometrics: BiometricReading[];
  avgHeartRate: number;
  avgFocus: number;
  avgRelaxation: number;
  avgStress: number;
  flowScore: number;
  duration: number;
  songCount: number;
}

type TimeRange = "7d" | "30d" | "90d";

const ACTIVITY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  sleep: Moon,
  workout: Dumbbell,
  study: BookOpen,
  relax: Coffee,
  commute: Car,
  meditation: Brain,
};

const MOOD_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  great: Smile,
  good: Smile,
  neutral: Meh,
  bad: Frown,
  terrible: Frown,
};

const MOOD_ICON_CLASS_MAP: Record<string, string> = {
  great: "w-5 h-5 text-green-500",
  good: "w-5 h-5 text-emerald-500",
  neutral: "w-5 h-5 text-yellow-500",
  bad: "w-5 h-5 text-orange-500",
  terrible: "w-5 h-5 text-red-500",
};

const moodOrder = ["terrible", "bad", "neutral", "good", "great"];

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

function averageNumber(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getDaysFromRange(range: TimeRange) {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  return 90;
}

const SessionRow = memo(function SessionRow({
  session,
  isExpanded,
  onToggle,
}: {
  session: SessionWithBiometrics;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}) {
  const ActivityIcon = ACTIVITY_ICON_MAP[session.activity_types?.name || ""] ?? Music;
  const MoodBeforeIcon = MOOD_ICON_MAP[session.mood_before || "neutral"] ?? Meh;
  const MoodAfterIcon = MOOD_ICON_MAP[session.mood_after || "neutral"] ?? Meh;

  const formattedStart = useMemo(
    () => format(parseISO(session.started_at), "MMM d, yyyy • h:mm a"),
    [session.started_at]
  );

  const eegAverages = useMemo(() => {
    const bands = ["delta", "theta", "alpha", "beta", "gamma"] as const;

    return bands.map((band) => {
      const key = `eeg_${band}` as keyof BiometricReading;
      const values = session.biometrics
        .map((reading) => reading[key] as number | null)
        .filter((value): value is number => value !== null);

      const avg =
        values.length > 0
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : 0;

      return {
        band,
        avg: avg.toFixed(1),
      };
    });
  }, [session.biometrics]);

  const hasEEGData = useMemo(
    () =>
      session.biometrics.some(
        (b) =>
          b.eeg_alpha !== null ||
          b.eeg_beta !== null ||
          b.eeg_theta !== null ||
          b.eeg_gamma !== null ||
          b.eeg_delta !== null
      ),
    [session.biometrics]
  );

  const handleToggle = useCallback(() => {
    onToggle(session.id);
  }, [onToggle, session.id]);

  return (
    <div className="overflow-hidden rounded-lg border transition-all">
      <button
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/50"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-primary/10 p-2">
            <ActivityIcon className="h-5 w-5" />
          </div>

          <div>
            <p className="font-medium">
              {session.name || `${session.activity_types?.name || "Unknown"} Session`}
            </p>
            <p className="text-sm text-muted-foreground">{formattedStart}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <MoodBeforeIcon className={MOOD_ICON_CLASS_MAP[session.mood_before || "neutral"]} />
            <span className="text-muted-foreground">→</span>
            <MoodAfterIcon className={MOOD_ICON_CLASS_MAP[session.mood_after || "neutral"]} />
          </div>

          <Badge variant={session.flowScore > 60 ? "default" : "secondary"}>
            {session.flowScore}% Flow
          </Badge>

          <Badge variant="outline">{session.duration}m</Badge>

          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-4 border-t bg-muted/30 p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-card p-3">
              <div className="mb-1 flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Heart Rate</span>
              </div>
              <p className="text-xl font-bold">{session.avgHeartRate || "—"} BPM</p>
            </div>

            <div className="rounded-lg bg-card p-3">
              <div className="mb-1 flex items-center gap-2">
                <Activity className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">Focus</span>
              </div>
              <p className="text-xl font-bold">{session.avgFocus || "—"}%</p>
            </div>

            <div className="rounded-lg bg-card p-3">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Relaxation</span>
              </div>
              <p className="text-xl font-bold">{session.avgRelaxation || "—"}%</p>
            </div>

            <div className="rounded-lg bg-card p-3">
              <div className="mb-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Stress</span>
              </div>
              <p className="text-xl font-bold">{session.avgStress || "—"}%</p>
            </div>
          </div>

          {hasEEGData && (
            <div className="rounded-lg bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                <span className="font-medium">EEG Brainwave Data</span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {eegAverages.map(({ band, avg }) => (
                  <div key={band} className="rounded bg-muted/50 p-2 text-center">
                    <p className="text-sm font-medium capitalize">{band}</p>
                    <p className="text-lg">{avg}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {session.notes && (
            <div className="rounded-lg bg-card p-4">
              <p className="mb-2 text-sm text-muted-foreground">Session Notes</p>
              <p>{session.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default function SessionHistory() {
  const navigate = useNavigate();
  const { user, isReady } = useAuthReady();

  const [sessions, setSessions] = useState<SessionWithBiometrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && !user) {
      navigate("/auth", { replace: true });
    }
  }, [isReady, user, navigate]);

  useEffect(() => {
    if (!isReady || !user) return;

    let isMounted = true;

    const fetchSessionHistory = async () => {
      setIsLoading(true);

      const startDate = subDays(new Date(), getDaysFromRange(timeRange));

      const { data: sessionsData, error: sessionsError } = await supabase
        .from("listening_sessions")
        .select(`
          *,
          activity_types(id, name),
          session_songs(id)
        `)
        .eq("user_id", user.id)
        .gte("started_at", startDate.toISOString())
        .order("started_at", { ascending: false });

      if (sessionsError) {
        console.error("Error fetching sessions:", sessionsError);
        if (isMounted) setIsLoading(false);
        return;
      }

      const { data: biometricsData, error: biometricsError } = await supabase
        .from("biometric_readings")
        .select("*")
        .eq("user_id", user.id)
        .gte("recorded_at", startDate.toISOString());

      if (biometricsError) {
        console.error("Error fetching biometrics:", biometricsError);
      }

      const biometricsBySession = new Map<string, BiometricReading[]>();

      for (const reading of biometricsData || []) {
        if (!reading.session_id) continue;
        const bucket = biometricsBySession.get(reading.session_id) ?? [];
        bucket.push(reading);
        biometricsBySession.set(reading.session_id, bucket);
      }

      const mergedSessions: SessionWithBiometrics[] = (sessionsData || []).map((session) => {
        const sessionBiometrics = biometricsBySession.get(session.id) ?? [];

        const heartRates = sessionBiometrics
          .map((b) => b.heart_rate)
          .filter((value): value is number => value !== null);

        const focusScores = sessionBiometrics
          .map((b) => b.focus_score)
          .filter((value): value is number => value !== null);

        const relaxationScores = sessionBiometrics
          .map((b) => b.relaxation_score)
          .filter((value): value is number => value !== null);

        const stressLevels = sessionBiometrics
          .map((b) => b.stress_level)
          .filter((value): value is number => value !== null);

        const avgHeartRate = averageNumber(heartRates);
        const avgFocus = averageNumber(focusScores);
        const avgRelaxation = averageNumber(relaxationScores);
        const avgStress = averageNumber(stressLevels);

        const flowScore = Math.round(
          Math.max(0, Math.min(100, avgFocus * 0.5 + avgRelaxation * 0.3 - avgStress * 0.2))
        );

        const startTime = new Date(session.started_at).getTime();
        const endTime = session.ended_at ? new Date(session.ended_at).getTime() : startTime;
        const duration = Math.max(0, Math.floor((endTime - startTime) / 1000 / 60));

        return {
          ...session,
          biometrics: sessionBiometrics,
          avgHeartRate,
          avgFocus,
          avgRelaxation,
          avgStress,
          flowScore,
          duration,
          songCount: session.session_songs?.length || 0,
        };
      });

      if (isMounted) {
        setSessions(mergedSessions);
        setIsLoading(false);
      }
    };

    fetchSessionHistory();

    return () => {
      isMounted = false;
    };
  }, [isReady, user, timeRange]);

  const filteredSessions = useMemo(() => {
    if (activityFilter === "all") return sessions;
    return sessions.filter(
      (session) =>
        session.activity_types?.name.toLowerCase() === activityFilter.toLowerCase()
    );
  }, [sessions, activityFilter]);

  const flowTrendData = useMemo(
    () =>
      filteredSessions
        .slice(0, 30)
        .reverse()
        .map((session) => ({
          date: format(parseISO(session.started_at), "MMM d"),
          flow: session.flowScore,
          focus: session.avgFocus,
          relaxation: session.avgRelaxation,
        })),
    [filteredSessions]
  );

  const activityChartData = useMemo(() => {
    const distribution = sessions.reduce<Record<string, number>>((acc, session) => {
      const activity = session.activity_types?.name || "Unknown";
      acc[activity] = (acc[activity] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(distribution).map(([name, count]) => ({
      name,
      sessions: count,
    }));
  }, [sessions]);

  const moodImprovement = useMemo(() => {
    return sessions.reduce(
      (acc, session) => {
        const beforeIndex = moodOrder.indexOf(session.mood_before || "neutral");
        const afterIndex = moodOrder.indexOf(session.mood_after || "neutral");
        const improvement = afterIndex - beforeIndex;

        if (improvement > 0) acc.improved += 1;
        else if (improvement < 0) acc.declined += 1;
        else acc.same += 1;

        return acc;
      },
      { improved: 0, same: 0, declined: 0 }
    );
  }, [sessions]);

  const averageStats = useMemo(() => {
    if (sessions.length === 0) {
      return {
        avgFlowScore: 0,
        avgDuration: 0,
        totalSessions: 0,
        avgHeartRate: 0,
      };
    }

    return {
      avgFlowScore: Math.round(
        sessions.reduce((sum, session) => sum + session.flowScore, 0) / sessions.length
      ),
      avgDuration: Math.round(
        sessions.reduce((sum, session) => sum + session.duration, 0) / sessions.length
      ),
      totalSessions: sessions.length,
      avgHeartRate: Math.round(
        sessions.reduce((sum, session) => sum + session.avgHeartRate, 0) / sessions.length
      ),
    };
  }, [sessions]);

  const handleBack = useCallback(() => {
    navigate("/dashboard");
  }, [navigate]);

  const handleGoToDashboard = useCallback(() => {
    navigate("/dashboard");
  }, [navigate]);

  const handleTimeRangeChange = useCallback((value: string) => {
    setTimeRange(value as TimeRange);
  }, []);

  const handleActivityFilterChange = useCallback((value: string) => {
    setActivityFilter(value);
  }, []);

  const handleToggleExpandedSession = useCallback((id: string) => {
    setExpandedSession((current) => (current === id ? null : id));
  }, []);

  if (!isReady) return <DashboardSkeleton />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div>
              <h1 className="text-xl font-bold">Session History</h1>
              <p className="text-sm text-muted-foreground">
                View past listening sessions and biometric data
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SessionExportButton sessions={filteredSessions} />

            <Select value={timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>

            <Select value={activityFilter} onValueChange={handleActivityFilterChange}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All activities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All activities</SelectItem>
                <SelectItem value="sleep">Sleep</SelectItem>
                <SelectItem value="workout">Workout</SelectItem>
                <SelectItem value="study">Study</SelectItem>
                <SelectItem value="relax">Relax</SelectItem>
                <SelectItem value="commute">Commute</SelectItem>
                <SelectItem value="meditation">Meditation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-8 px-4 py-8 pb-24">
        {isLoading ? (
          <ChartSkeleton />
        ) : sessions.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={Calendar}
              title="No sessions yet"
              description="Start your first listening session to see your history and progress here."
              actionLabel="Go to Dashboard"
              onAction={handleGoToDashboard}
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-primary/20 p-3">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{averageStats.totalSessions}</p>
                      <p className="text-sm text-muted-foreground">Total Sessions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-green-500/20 p-3">
                      <Sparkles className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{averageStats.avgFlowScore}%</p>
                      <p className="text-sm text-muted-foreground">Avg Flow Score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-blue-500/20 p-3">
                      <Clock className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{averageStats.avgDuration}m</p>
                      <p className="text-sm text-muted-foreground">Avg Duration</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-red-500/20 p-3">
                      <Heart className="h-6 w-6 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{averageStats.avgHeartRate}</p>
                      <p className="text-sm text-muted-foreground">Avg Heart Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Flow Score Trend
                  </CardTitle>
                  <CardDescription>Your flow state progress over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={flowTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Area
                          type="monotone"
                          dataKey="flow"
                          name="Flow Score"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.3}
                        />
                        <Area
                          type="monotone"
                          dataKey="focus"
                          name="Focus"
                          stroke="#f59e0b"
                          fill="#f59e0b"
                          fillOpacity={0.2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Activity Distribution
                  </CardTitle>
                  <CardDescription>Sessions by activity type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activityChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smile className="h-5 w-5 text-primary" />
                  Mood Impact
                </CardTitle>
                <CardDescription>How music affects your mood</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center">
                    <p className="text-3xl font-bold text-green-500">{moodImprovement.improved}</p>
                    <p className="text-sm text-muted-foreground">Improved</p>
                    <Progress
                      value={
                        sessions.length > 0
                          ? (moodImprovement.improved / sessions.length) * 100
                          : 0
                      }
                      className="mt-2 h-2"
                    />
                  </div>

                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
                    <p className="text-3xl font-bold text-yellow-500">{moodImprovement.same}</p>
                    <p className="text-sm text-muted-foreground">Unchanged</p>
                    <Progress
                      value={
                        sessions.length > 0 ? (moodImprovement.same / sessions.length) * 100 : 0
                      }
                      className="mt-2 h-2"
                    />
                  </div>

                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center">
                    <p className="text-3xl font-bold text-red-500">{moodImprovement.declined}</p>
                    <p className="text-sm text-muted-foreground">Declined</p>
                    <Progress
                      value={
                        sessions.length > 0
                          ? (moodImprovement.declined / sessions.length) * 100
                          : 0
                      }
                      className="mt-2 h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Session Details
                </CardTitle>
                <CardDescription>
                  {filteredSessions.length} sessions in the selected period
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {filteredSessions.length === 0 ? (
                    <EmptyState
                      icon={Calendar}
                      title="No sessions found"
                      description="Try changing the time range or activity filter."
                    />
                  ) : (
                    filteredSessions.map((session) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        isExpanded={expandedSession === session.id}
                        onToggle={handleToggleExpandedSession}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

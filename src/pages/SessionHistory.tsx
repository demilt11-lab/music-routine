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

const ACTIVITY_ICON_MAP: Record<string, React.ElementType> = {
  sleep: Moon,
  workout: Dumbbell,
  study: BookOpen,
  relax: Coffee,
  commute: Car,
  meditation: Brain,
};

const MOOD_ICON_MAP: Record<string, React.ElementType> = {
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
      const avg = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      return { band, avg: avg.toFixed(1) };
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
    <Card key={session.id} className="mb-4 hover:shadow-md transition-shadow cursor-pointer" onClick={handleToggle}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 flex-1">
            <ActivityIcon className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg mb-1">
                {session.name || `${session.activity_types?.name || "Unknown"} Session`}
              </h3>
              <p className="text-sm text-muted-foreground">{formattedStart}</p>
              <div className="flex items-center gap-2 mt-2">
                <MoodBeforeIcon className={MOOD_ICON_CLASS_MAP[session.mood_before || "neutral"]} />
                <span className="text-xs text-muted-foreground">→</span>
                <MoodAfterIcon className={MOOD_ICON_CLASS_MAP[session.mood_after || "neutral"]} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={session.flowScore > 60 ? "default" : "secondary"}>
              <Sparkles className="w-3 h-3 mr-1" /> {session.flowScore}% Flow
            </Badge>
            <Badge variant="outline">
              <Clock className="w-3 h-3 mr-1" /> {session.duration}m
            </Badge>
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Heart className="w-4 h-4" /> Heart Rate
                </p>
                <p className="text-2xl font-semibold mt-1">{session.avgHeartRate || "—"} <span className="text-sm font-normal text-muted-foreground">BPM</span></p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Brain className="w-4 h-4" /> Focus
                </p>
                <p className="text-2xl font-semibold mt-1">{session.avgFocus || "—"}<span className="text-sm font-normal text-muted-foreground">%</span></p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Activity className="w-4 h-4" /> Relaxation
                </p>
                <p className="text-2xl font-semibold mt-1">{session.avgRelaxation || "—"}<span className="text-sm font-normal text-muted-foreground">%</span></p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> Stress
                </p>
                <p className="text-2xl font-semibold mt-1">{session.avgStress || "—"}<span className="text-sm font-normal text-muted-foreground">%</span></p>
              </div>
            </div>
            {hasEEGData && (
              <div>
                <h4 className="text-sm font-medium mb-2">EEG Brainwave Data</h4>
                <div className="grid grid-cols-5 gap-2">
                  {eegAverages.map(({ band, avg }) => (
                    <div key={band} className="text-center">
                      <p className="text-xs text-muted-foreground capitalize">{band}</p>
                      <p className="text-sm font-semibold">{avg}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {session.notes && (
              <div>
                <h4 className="text-sm font-medium mb-1">Session Notes</h4>
                <p className="text-sm text-muted-foreground">{session.notes}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default function SessionHistory() {
  const navigate = useNavigate();
  const { user, isReady } = useAuthReady();
  const [sessions, setSessions] = useState<SessionWithBiometrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [activityFilter, setActivityFilter] = useState("all");
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
      setError(null);
      const startDate = subDays(new Date(), getDaysFromRange(timeRange));

      try {
        const [sessionsResult, biometricsResult] = await Promise.all([
          supabase
            .from("listening_sessions")
            .select(`
              *,
              activity_types(id, name),
              session_songs(id)
            `)
            .eq("user_id", user.id)
            .gte("started_at", startDate.toISOString())
            .order("started_at", { ascending: false }),
          supabase
            .from("biometric_readings")
            .select("*")
            .eq("user_id", user.id)
            .gte("recorded_at", startDate.toISOString()),
        ]);

        const { data: sessionsData, error: sessionsError } = sessionsResult;
        const { data: biometricsData, error: biometricsError } = biometricsResult;

        if (sessionsError) throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);
        if (biometricsError) throw new Error(`Failed to fetch biometrics: ${biometricsError.message}`);

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
          const flowScore = Math.round(Math.max(0, Math.min(100, avgFocus * 0.5 + avgRelaxation * 0.3 - avgStress * 0.2)));

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
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load session history";
        if (isMounted) {
          setError(errorMessage);
          setIsLoading(false);
        }
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
      (session) => session.activity_types?.name.toLowerCase() === activityFilter.toLowerCase()
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
    return Object.entries(distribution).map(([name, count]) => ({ name, sessions: count }));
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
      return { avgFlowScore: 0, avgDuration: 0, totalSessions: 0, avgHeartRate: 0 };
    }
    return {
      avgFlowScore: Math.round(sessions.reduce((sum, session) => sum + session.flowScore, 0) / sessions.length),
      avgDuration: Math.round(sessions.reduce((sum, session) => sum + session.duration, 0) / sessions.length),
      totalSessions: sessions.length,
      avgHeartRate: Math.round(sessions.reduce((sum, session) => sum + session.avgHeartRate, 0) / sessions.length),
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">Session History</h1>
          </div>
          <p className="text-muted-foreground ml-12">View past listening sessions and biometric data</p>
        </div>
        <SessionExportButton sessions={sessions} />
      </div>

      <div className="flex gap-2 items-center">
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

      {isLoading ? (
        <ChartSkeleton />
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Activity}
              title="Failed to load sessions"
              description={error}
              action={<Button onClick={() => window.location.reload()}>Retry</Button>}
            />
          </CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={Music}
          title="No sessions yet"
          description="Start a listening session to see your history here"
          action={<Button onClick={handleGoToDashboard}>Go to Dashboard</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-4xl font-bold">{averageStats.totalSessions}</CardTitle>
                <CardDescription>Total Sessions</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-4xl font-bold">{averageStats.avgFlowScore}%</CardTitle>
                <CardDescription>Avg Flow Score</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-4xl font-bold">{averageStats.avgDuration}m</CardTitle>
                <CardDescription>Avg Duration</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-4xl font-bold">{averageStats.avgHeartRate}</CardTitle>
                <CardDescription>Avg Heart Rate</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Flow Score Trend</CardTitle>
                <CardDescription>Your flow state progress over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={flowTrendData}>
                    <defs>
                      <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="flow"
                      stroke="hsl(var(--primary))"
                      fill="url(#colorFlow)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity Distribution</CardTitle>
                <CardDescription>Sessions by activity type</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={activityChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Mood Impact</CardTitle>
              <CardDescription>How music affects your mood</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-2xl font-bold mb-1">{moodImprovement.improved}</p>
                  <p className="text-sm text-muted-foreground mb-2">Improved</p>
                  <Progress
                    value={sessions.length > 0 ? (moodImprovement.improved / sessions.length) * 100 : 0}
                    className="mt-2 h-2"
                  />
                </div>
                <div>
                  <p className="text-2xl font-bold mb-1">{moodImprovement.same}</p>
                  <p className="text-sm text-muted-foreground mb-2">Unchanged</p>
                  <Progress
                    value={sessions.length > 0 ? (moodImprovement.same / sessions.length) * 100 : 0}
                    className="mt-2 h-2"
                  />
                </div>
                <div>
                  <p className="text-2xl font-bold mb-1">{moodImprovement.declined}</p>
                  <p className="text-sm text-muted-foreground mb-2">Declined</p>
                  <Progress
                    value={sessions.length > 0 ? (moodImprovement.declined / sessions.length) * 100 : 0}
                    className="mt-2 h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session Details</CardTitle>
              <CardDescription>{filteredSessions.length} sessions in the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredSessions.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No sessions found"
                  description="Try adjusting your filters"
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

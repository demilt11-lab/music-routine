import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Calendar, Clock, Heart, Brain, Music, 
  TrendingUp, Filter, BarChart3, Activity, Moon,
  Dumbbell, BookOpen, Coffee, Car, Sparkles,
  Smile, Meh, Frown, ChevronDown, ChevronUp
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { SessionExportButton } from "@/components/dashboard/SessionExportButton";
import { ListSkeleton, ChartSkeleton } from "@/components/skeletons/ListSkeleton";
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
}

const activityIcons: Record<string, React.ReactNode> = {
  sleep: <Moon className="w-5 h-5" />,
  workout: <Dumbbell className="w-5 h-5" />,
  study: <BookOpen className="w-5 h-5" />,
  relax: <Coffee className="w-5 h-5" />,
  commute: <Car className="w-5 h-5" />,
  meditation: <Brain className="w-5 h-5" />,
};

const moodIcons: Record<string, React.ReactNode> = {
  great: <Smile className="w-5 h-5 text-green-500" />,
  good: <Smile className="w-5 h-5 text-emerald-500" />,
  neutral: <Meh className="w-5 h-5 text-yellow-500" />,
  bad: <Frown className="w-5 h-5 text-orange-500" />,
  terrible: <Frown className="w-5 h-5 text-red-500" />,
};

export default function SessionHistory() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionWithBiometrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    fetchSessionHistory();
  }, [timeRange]);

  const fetchSessionHistory = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const startDate = subDays(new Date(), days);

    // Fetch sessions with song counts
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
      setIsLoading(false);
      return;
    }

    // Fetch biometric readings
    const { data: biometricsData } = await supabase
      .from("biometric_readings")
      .select("*")
      .eq("user_id", user.id)
      .gte("recorded_at", startDate.toISOString());

    // Combine sessions with their biometric data
    const sessionsWithBiometrics: SessionWithBiometrics[] = (sessionsData || []).map((session) => {
      const sessionBiometrics = (biometricsData || []).filter(
        (b) => b.session_id === session.id
      );

      const avgHeartRate = sessionBiometrics.length > 0
        ? sessionBiometrics.reduce((sum, b) => sum + (b.heart_rate || 0), 0) / sessionBiometrics.length
        : 0;
      const avgFocus = sessionBiometrics.length > 0
        ? sessionBiometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / sessionBiometrics.length
        : 0;
      const avgRelaxation = sessionBiometrics.length > 0
        ? sessionBiometrics.reduce((sum, b) => sum + (b.relaxation_score || 0), 0) / sessionBiometrics.length
        : 0;
      const avgStress = sessionBiometrics.length > 0
        ? sessionBiometrics.reduce((sum, b) => sum + (b.stress_level || 0), 0) / sessionBiometrics.length
        : 0;

      // Calculate flow score
      const flowScore = avgFocus * 0.5 + avgRelaxation * 0.3 - avgStress * 0.2;

      // Calculate duration
      const startTime = new Date(session.started_at).getTime();
      const endTime = session.ended_at ? new Date(session.ended_at).getTime() : startTime;
      const duration = Math.floor((endTime - startTime) / 1000 / 60); // minutes

      return {
        ...session,
        biometrics: sessionBiometrics,
        avgHeartRate: Math.round(avgHeartRate),
        avgFocus: Math.round(avgFocus),
        avgRelaxation: Math.round(avgRelaxation),
        avgStress: Math.round(avgStress),
        flowScore: Math.round(Math.max(0, Math.min(100, flowScore))),
        duration,
        songCount: (session as any).session_songs?.length || 0,
      };
    });

    setSessions(sessionsWithBiometrics);
    setIsLoading(false);
  };

  const filteredSessions = sessions.filter((session) => {
    if (activityFilter === "all") return true;
    return session.activity_types?.name.toLowerCase() === activityFilter.toLowerCase();
  });

  // Aggregate data for charts
  const flowTrendData = filteredSessions
    .slice(0, 30)
    .reverse()
    .map((session) => ({
      date: format(parseISO(session.started_at), "MMM d"),
      flow: session.flowScore,
      focus: session.avgFocus,
      relaxation: session.avgRelaxation,
    }));

  const activityDistribution = sessions.reduce((acc, session) => {
    const activity = session.activity_types?.name || "Unknown";
    acc[activity] = (acc[activity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activityChartData = Object.entries(activityDistribution).map(([name, count]) => ({
    name,
    sessions: count,
  }));

  const moodImprovement = sessions.reduce((acc, session) => {
    const moodOrder = ["terrible", "bad", "neutral", "good", "great"];
    const beforeIndex = moodOrder.indexOf(session.mood_before || "neutral");
    const afterIndex = moodOrder.indexOf(session.mood_after || "neutral");
    const improvement = afterIndex - beforeIndex;
    
    if (improvement > 0) acc.improved++;
    else if (improvement < 0) acc.declined++;
    else acc.same++;
    
    return acc;
  }, { improved: 0, same: 0, declined: 0 });

  const averageStats = {
    avgFlowScore: sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.flowScore, 0) / sessions.length)
      : 0,
    avgDuration: sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length)
      : 0,
    totalSessions: sessions.length,
    avgHeartRate: sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.avgHeartRate, 0) / sessions.length)
      : 0,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
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
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={activityFilter} onValueChange={setActivityFilter}>
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
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8 pb-24">
        {isLoading ? (
          <ChartSkeleton />
        ) : sessions.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={Calendar}
              title="No sessions yet"
              description="Start your first listening session to see your history and progress here."
              actionLabel="Go to Dashboard"
              onAction={() => navigate("/dashboard")}
            />
          </Card>
        ) : (
        <>
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/20">
                  <Activity className="w-6 h-6 text-primary" />
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
                <div className="p-3 rounded-full bg-green-500/20">
                  <Sparkles className="w-6 h-6 text-green-500" />
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
                <div className="p-3 rounded-full bg-blue-500/20">
                  <Clock className="w-6 h-6 text-blue-500" />
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
                <div className="p-3 rounded-full bg-red-500/20">
                  <Heart className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{averageStats.avgHeartRate}</p>
                  <p className="text-sm text-muted-foreground">Avg Heart Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Flow Score Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
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
                    <YAxis 
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
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

          {/* Activity Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
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
                    <YAxis 
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mood Improvement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smile className="w-5 h-5 text-primary" />
              Mood Impact
            </CardTitle>
            <CardDescription>How music affects your mood</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                <p className="text-3xl font-bold text-green-500">{moodImprovement.improved}</p>
                <p className="text-sm text-muted-foreground">Improved</p>
                <Progress 
                  value={sessions.length > 0 ? (moodImprovement.improved / sessions.length) * 100 : 0} 
                  className="mt-2 h-2"
                />
              </div>
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-center">
                <p className="text-3xl font-bold text-yellow-500">{moodImprovement.same}</p>
                <p className="text-sm text-muted-foreground">Unchanged</p>
                <Progress 
                  value={sessions.length > 0 ? (moodImprovement.same / sessions.length) * 100 : 0} 
                  className="mt-2 h-2"
                />
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                <p className="text-3xl font-bold text-red-500">{moodImprovement.declined}</p>
                <p className="text-sm text-muted-foreground">Declined</p>
                <Progress 
                  value={sessions.length > 0 ? (moodImprovement.declined / sessions.length) * 100 : 0} 
                  className="mt-2 h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
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
                  <div
                    key={session.id}
                    className="border rounded-lg overflow-hidden transition-all"
                  >
                    {/* Session Header */}
                    <button
                      className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedSession(
                        expandedSession === session.id ? null : session.id
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-primary/10">
                          {activityIcons[session.activity_types?.name || ""] || <Music className="w-5 h-5" />}
                        </div>
                        <div className="text-left">
                          <p className="font-medium">
                            {session.name || `${session.activity_types?.name || "Unknown"} Session`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(session.started_at), "MMM d, yyyy • h:mm a")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {moodIcons[session.mood_before || "neutral"]}
                          <span className="text-muted-foreground">→</span>
                          {moodIcons[session.mood_after || "neutral"]}
                        </div>
                        <Badge variant={session.flowScore > 60 ? "default" : "secondary"}>
                          {session.flowScore}% Flow
                        </Badge>
                        <Badge variant="outline">{session.duration}m</Badge>
                        {expandedSession === session.id ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {expandedSession === session.id && (
                      <div className="p-4 border-t bg-muted/30 space-y-4">
                        {/* Biometric Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-3 rounded-lg bg-card">
                            <div className="flex items-center gap-2 mb-1">
                              <Heart className="w-4 h-4 text-red-500" />
                              <span className="text-sm text-muted-foreground">Heart Rate</span>
                            </div>
                            <p className="text-xl font-bold">{session.avgHeartRate || "—"} BPM</p>
                          </div>
                          <div className="p-3 rounded-lg bg-card">
                            <div className="flex items-center gap-2 mb-1">
                              <Activity className="w-4 h-4 text-yellow-500" />
                              <span className="text-sm text-muted-foreground">Focus</span>
                            </div>
                            <p className="text-xl font-bold">{session.avgFocus || "—"}%</p>
                          </div>
                          <div className="p-3 rounded-lg bg-card">
                            <div className="flex items-center gap-2 mb-1">
                              <Sparkles className="w-4 h-4 text-green-500" />
                              <span className="text-sm text-muted-foreground">Relaxation</span>
                            </div>
                            <p className="text-xl font-bold">{session.avgRelaxation || "—"}%</p>
                          </div>
                          <div className="p-3 rounded-lg bg-card">
                            <div className="flex items-center gap-2 mb-1">
                              <TrendingUp className="w-4 h-4 text-orange-500" />
                              <span className="text-sm text-muted-foreground">Stress</span>
                            </div>
                            <p className="text-xl font-bold">{session.avgStress || "—"}%</p>
                          </div>
                        </div>

                        {/* EEG Data if available */}
                        {session.biometrics.some(b => b.eeg_alpha !== null) && (
                          <div className="p-4 rounded-lg bg-card">
                            <div className="flex items-center gap-2 mb-3">
                              <Brain className="w-5 h-5 text-purple-500" />
                              <span className="font-medium">EEG Brainwave Data</span>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                              {["delta", "theta", "alpha", "beta", "gamma"].map((band) => {
                                const avg = session.biometrics
                                  .filter(b => b[`eeg_${band}` as keyof BiometricReading] !== null)
                                  .reduce((sum, b, _, arr) => 
                                    sum + ((b[`eeg_${band}` as keyof BiometricReading] as number) || 0) / arr.length, 0
                                  );
                                return (
                                  <div key={band} className="text-center p-2 rounded bg-muted/50">
                                    <p className="text-sm font-medium capitalize">{band}</p>
                                    <p className="text-lg">{avg.toFixed(1)}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {session.notes && (
                          <div className="p-4 rounded-lg bg-card">
                            <p className="text-sm text-muted-foreground mb-2">Session Notes</p>
                            <p>{session.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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

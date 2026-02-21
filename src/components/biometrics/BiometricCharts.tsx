import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ReferenceLine, ComposedChart
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Brain, Heart, Music, TrendingUp } from "lucide-react";
import { useCurrentUser, useBiometricsByRange, useSessionsByRange } from "@/hooks/useDashboardData";

interface BiometricReading {
  id: string;
  heart_rate: number | null;
  stress_level: number | null;
  focus_score: number | null;
  relaxation_score: number | null;
  recorded_at: string;
  session_id: string | null;
}

interface SessionWithSongs {
  id: string;
  name: string | null;
  started_at: string;
  activity_types: { name: string } | null;
  session_songs: {
    songs: {
      tempo: number | null;
      energy: number | null;
      valence: number | null;
    } | null;
  }[];
}

interface ChartDataPoint {
  time: string;
  timestamp: number;
  heartRate: number;
  stressLevel: number;
  focusScore: number;
  relaxationScore: number;
  tempo?: number;
  energy?: number;
  flowState?: number;
}

interface CorrelationDataPoint {
  tempo: number;
  energy: number;
  focusScore: number;
  relaxationScore: number;
  activityType: string;
}

const calculateFlowScore = (focus: number, relaxation: number, stress: number) => {
  return Math.round(focus * 0.5 + relaxation * 0.3 - stress * 0.2 + 20);
};

export function BiometricCharts() {
  const { data: user } = useCurrentUser();
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");
  const { data: readings, isLoading: readingsLoading } = useBiometricsByRange(user?.id, timeRange);
  const { data: sessions, isLoading: sessionsLoading } = useSessionsByRange(user?.id, timeRange);

  const isLoading = readingsLoading || sessionsLoading;

  const { chartData, correlationData, activityBreakdown } = useMemo(() => {
    if (!readings) return { chartData: [], correlationData: [], activityBreakdown: [] };

    const timelineData: ChartDataPoint[] = readings.map((r: BiometricReading) => {
      const date = new Date(r.recorded_at);
      return {
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: date.getTime(),
        heartRate: r.heart_rate || 0,
        stressLevel: r.stress_level || 0,
        focusScore: r.focus_score || 0,
        relaxationScore: r.relaxation_score || 0,
        flowState: calculateFlowScore(r.focus_score || 0, r.relaxation_score || 0, r.stress_level || 0),
      };
    });

    const correlations: CorrelationDataPoint[] = [];
    const activityStats: Record<string, { focus: number[]; relaxation: number[]; tempo: number[]; energy: number[] }> = {};

    (sessions || []).forEach((session: SessionWithSongs) => {
      const sessionReadings = readings.filter((r: BiometricReading) => r.session_id === session.id);
      if (sessionReadings.length === 0) return;

      const avgFocus = sessionReadings.reduce((sum: number, r: BiometricReading) => sum + (r.focus_score || 0), 0) / sessionReadings.length;
      const avgRelax = sessionReadings.reduce((sum: number, r: BiometricReading) => sum + (r.relaxation_score || 0), 0) / sessionReadings.length;

      const activityType = session.activity_types?.name || "unknown";
      
      if (!activityStats[activityType]) {
        activityStats[activityType] = { focus: [], relaxation: [], tempo: [], energy: [] };
      }
      activityStats[activityType].focus.push(avgFocus);
      activityStats[activityType].relaxation.push(avgRelax);

      session.session_songs?.forEach((ss) => {
        if (ss.songs?.tempo && ss.songs?.energy) {
          correlations.push({
            tempo: ss.songs.tempo,
            energy: ss.songs.energy * 100,
            focusScore: avgFocus,
            relaxationScore: avgRelax,
            activityType,
          });
          activityStats[activityType].tempo.push(ss.songs.tempo);
          activityStats[activityType].energy.push(ss.songs.energy * 100);
        }
      });
    });

    const breakdown = Object.entries(activityStats).map(([activity, stats]) => ({
      activity: activity.charAt(0).toUpperCase() + activity.slice(1),
      avgFocus: stats.focus.length > 0 ? Math.round(stats.focus.reduce((a, b) => a + b, 0) / stats.focus.length) : 0,
      avgRelaxation: stats.relaxation.length > 0 ? Math.round(stats.relaxation.reduce((a, b) => a + b, 0) / stats.relaxation.length) : 0,
      avgTempo: stats.tempo.length > 0 ? Math.round(stats.tempo.reduce((a, b) => a + b, 0) / stats.tempo.length) : 0,
      avgEnergy: stats.energy.length > 0 ? Math.round(stats.energy.reduce((a, b) => a + b, 0) / stats.energy.length) : 0,
    }));

    return { chartData: timelineData, correlationData: correlations, activityBreakdown: breakdown };
  }, [readings, sessions]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Biometric Trends</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasData = chartData.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Biometric Trends & Correlations
          </h2>
          <p className="text-sm text-muted-foreground">
            Visualize how music affects your physiological state
          </p>
        </div>
        <Select value={timeRange} onValueChange={(v: "24h" | "7d" | "30d") => setTimeRange(v)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!hasData ? (
        <Card className="p-8 text-center">
          <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">No Biometric Data Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Start a listening session with biometric tracking enabled to see your trends and correlations here.
          </p>
        </Card>
      ) : (
        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="timeline" className="gap-1">
              <Heart className="w-4 h-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="flow" className="gap-1">
              <Brain className="w-4 h-4" />
              Flow State
            </TabsTrigger>
            <TabsTrigger value="correlation" className="gap-1">
              <Music className="w-4 h-4" />
              Music Correlation
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1">
              <Activity className="w-4 h-4" />
              By Activity
            </TabsTrigger>
          </TabsList>

          {/* Heart Rate & Stress Timeline */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Heart Rate & Stress Over Time</CardTitle>
                <CardDescription>Track how your vital signs change during music sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      yAxisId="hr" 
                      orientation="left" 
                      domain={[50, 150]}
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Heart Rate (bpm)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                    />
                    <YAxis 
                      yAxisId="stress" 
                      orientation="right" 
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Stress %', angle: 90, position: 'insideRight', style: { fontSize: 11 } }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <ReferenceLine yAxisId="hr" y={72} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
                    <Line 
                      yAxisId="hr"
                      type="monotone" 
                      dataKey="heartRate" 
                      stroke="hsl(var(--destructive))" 
                      name="Heart Rate"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Area 
                      yAxisId="stress"
                      type="monotone" 
                      dataKey="stressLevel" 
                      fill="hsl(var(--warning) / 0.3)" 
                      stroke="hsl(var(--warning))"
                      name="Stress Level"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Flow State Analysis */}
          <TabsContent value="flow">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Flow State Analysis</CardTitle>
                <CardDescription>Focus vs Relaxation with Flow State indicator</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <ReferenceLine y={60} stroke="hsl(var(--primary))" strokeDasharray="5 5" label="Flow Threshold" />
                    <Area 
                      type="monotone" 
                      dataKey="focusScore" 
                      stackId="1"
                      stroke="hsl(262, 83%, 58%)" 
                      fill="hsl(262, 83%, 58%, 0.4)"
                      name="Focus"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="relaxationScore" 
                      stackId="2"
                      stroke="hsl(142, 71%, 45%)" 
                      fill="hsl(142, 71%, 45%, 0.4)"
                      name="Relaxation"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="flowState" 
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={false}
                      name="Flow Score"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Music Correlation Scatter */}
          <TabsContent value="correlation">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tempo vs Focus Score</CardTitle>
                  <CardDescription>Find your optimal BPM for concentration</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        type="number" 
                        dataKey="tempo" 
                        name="Tempo" 
                        unit=" BPM"
                        domain={[60, 180]}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="focusScore" 
                        name="Focus" 
                        unit="%"
                        domain={[0, 100]}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Scatter 
                        name="Sessions" 
                        data={correlationData} 
                        fill="hsl(262, 83%, 58%)"
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Energy vs Relaxation</CardTitle>
                  <CardDescription>How song energy affects your calm</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        type="number" 
                        dataKey="energy" 
                        name="Energy" 
                        unit="%"
                        domain={[0, 100]}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="relaxationScore" 
                        name="Relaxation" 
                        unit="%"
                        domain={[0, 100]}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Scatter 
                        name="Sessions" 
                        data={correlationData} 
                        fill="hsl(142, 71%, 45%)"
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Activity Breakdown */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance by Activity</CardTitle>
                <CardDescription>Compare biometric responses across different activities</CardDescription>
              </CardHeader>
              <CardContent>
                {activityBreakdown.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No activity data available yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={activityBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <YAxis dataKey="activity" type="category" width={80} tick={{ fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar dataKey="avgFocus" fill="hsl(262, 83%, 58%)" name="Avg Focus %" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="avgRelaxation" fill="hsl(142, 71%, 45%)" name="Avg Relaxation %" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="avgEnergy" fill="hsl(38, 92%, 50%)" name="Avg Song Energy %" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

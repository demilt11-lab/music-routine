import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
} from "recharts";
import {
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Flame,
  Target,
  Music,
  Brain,
  Activity,
  Zap,
  RefreshCw,
  Sun,
  Moon,
  Sunrise,
  Sunset,
} from "lucide-react";
import { useWeeklyInsights, WeeklyInsightsData } from "@/hooks/useWeeklyInsights";

const getTimeIcon = (hour: number) => {
  if (hour >= 5 && hour < 12) return <Sunrise className="h-4 w-4" />;
  if (hour >= 12 && hour < 17) return <Sun className="h-4 w-4" />;
  if (hour >= 17 && hour < 21) return <Sunset className="h-4 w-4" />;
  return <Moon className="h-4 w-4" />;
};

const formatHour = (hour: number) => {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
}

function StatCard({ title, value, subtitle, icon, trend, trendLabel }: StatCardProps) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            {icon}
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-2 flex items-center gap-1">
            {trend >= 0 ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span className={`text-xs ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
              {trend >= 0 ? "+" : ""}{trend}%
            </span>
            {trendLabel && <span className="text-xs text-muted-foreground">{trendLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DayPatternChart({ data }: { data: WeeklyInsightsData["dayPatterns"] }) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Daily Session Patterns
        </CardTitle>
        <CardDescription>Sessions and flow scores by day of week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="day" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar 
                yAxisId="left"
                dataKey="totalSessions" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
                name="Sessions"
              />
              <Bar 
                yAxisId="right"
                dataKey="avgFlowScore" 
                fill="hsl(var(--secondary))" 
                radius={[4, 4, 0, 0]}
                name="Avg Flow %"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function HourlyHeatmap({ data }: { data: WeeklyInsightsData["hourPatterns"] }) {
  // Filter to show only hours with activity or common waking hours
  const relevantHours = data.filter(h => h.hour >= 6 && h.hour <= 23);
  
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Optimal Timing Heatmap
        </CardTitle>
        <CardDescription>Flow scores by hour of day</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={relevantHours}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="label" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                interval={2}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
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
                dataKey="avgFlowScore"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
                name="Flow Score"
              />
              <Area
                type="monotone"
                dataKey="avgStress"
                stroke="hsl(var(--destructive))"
                fill="hsl(var(--destructive))"
                fillOpacity={0.2}
                name="Stress Level"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyComparison({ current, previous }: { 
  current: WeeklyInsightsData["currentWeekTrend"]; 
  previous: WeeklyInsightsData["previousWeekTrend"];
}) {
  if (!current) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-6 text-center text-muted-foreground">
          <p>No data for this week yet. Start a session to see your progress!</p>
        </CardContent>
      </Card>
    );
  }

  const comparisonData = [
    { metric: "Sessions", current: current.totalSessions, previous: previous?.totalSessions || 0 },
    { metric: "Minutes", current: current.totalMinutes, previous: previous?.totalMinutes || 0 },
    { metric: "Flow Score", current: current.avgFlowScore, previous: previous?.avgFlowScore || 0 },
  ];

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Week-over-Week Progress
        </CardTitle>
        <CardDescription>Compare this week to last week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis 
                dataKey="metric" 
                type="category" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="previous" fill="hsl(var(--muted))" name="Last Week" radius={[0, 4, 4, 0]} />
              <Bar dataKey="current" fill="hsl(var(--primary))" name="This Week" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              {getTimeIcon(current.mostProductiveHour)}
              <span className="text-sm font-medium">{formatHour(current.mostProductiveHour)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Peak Hour</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">{current.mostProductiveDay}</p>
            <p className="text-xs text-muted-foreground">Best Day</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">{current.topActivity}</p>
            <p className="text-xs text-muted-foreground">Top Activity</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MusicTimingInsights({ insights }: { insights: WeeklyInsightsData["musicTimingInsights"] }) {
  const [selectedActivity, setSelectedActivity] = useState<string | null>(
    insights.length > 0 ? insights[0].activityName : null
  );

  const selected = insights.find(i => i.activityName === selectedActivity);

  const radarData = insights.map(insight => ({
    activity: insight.activityName,
    flowRate: insight.flowAchievementRate,
    duration: Math.min(insight.avgSessionDuration, 100),
    consistency: insight.bestDays.length * 20,
  }));

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          Optimal Music Timing by Activity
        </CardTitle>
        <CardDescription>When and what music works best for each activity</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {insights.map(insight => (
            <Badge
              key={insight.activityName}
              variant={selectedActivity === insight.activityName ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedActivity(insight.activityName)}
            >
              {insight.activityName}
            </Badge>
          ))}
        </div>

        {selected && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Best Days</p>
                <div className="flex gap-2">
                  {selected.bestDays.map(day => (
                    <Badge key={day} variant="secondary">{day}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Best Hours</p>
                <div className="flex gap-2">
                  {selected.bestHours.map(hour => (
                    <Badge key={hour} variant="outline" className="flex items-center gap-1">
                      {getTimeIcon(hour)}
                      {formatHour(hour)}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Optimal Tempo</p>
                  <p className="text-lg text-primary">
                    {selected.optimalTempo.min}-{selected.optimalTempo.max} BPM
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Optimal Energy</p>
                  <p className="text-lg text-primary">
                    {selected.optimalEnergy.min}-{selected.optimalEnergy.max}%
                  </p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Flow Achievement Rate</span>
                  <span>{selected.flowAchievementRate}%</span>
                </div>
                <Progress value={selected.flowAchievementRate} className="h-2" />
              </div>

              <div className="text-sm text-muted-foreground">
                Average session: <span className="font-medium">{selected.avgSessionDuration} min</span>
              </div>
            </div>

            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis 
                    dataKey="activity" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                  />
                  <PolarRadiusAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Radar
                    name="Flow Rate"
                    dataKey="flowRate"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {insights.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No activity data yet. Start some sessions to see timing insights!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PeakPerformanceWindows({ dayPatterns, hourPatterns }: {
  dayPatterns: WeeklyInsightsData["dayPatterns"];
  hourPatterns: WeeklyInsightsData["hourPatterns"];
}) {
  // Find top 3 performing day-hour combinations
  const combinations = dayPatterns.flatMap(day => 
    hourPatterns
      .filter(h => h.sessionCount > 0)
      .map(hour => ({
        day: day.day,
        hour: hour.hour,
        score: (day.avgFlowScore + hour.avgFlowScore) / 2,
        sessions: day.totalSessions + hour.sessionCount,
      }))
  );

  const topCombinations = combinations
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Peak Performance Windows
        </CardTitle>
        <CardDescription>Your best times for flow state</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-3">
            {topCombinations.map((combo, index) => (
              <div 
                key={`${combo.day}-${combo.hour}`}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{combo.day} at {formatHour(combo.hour)}</p>
                    <p className="text-xs text-muted-foreground">
                      Flow potential: {Math.round(combo.score)}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getTimeIcon(combo.hour)}
                  <Badge variant="outline">{combo.sessions} sessions</Badge>
                </div>
              </div>
            ))}

            {topCombinations.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Complete more sessions to discover your peak windows
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function WeeklyInsightsDashboard() {
  const { data, isLoading, error, refresh } = useWeeklyInsights();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Weekly Insights</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardContent className="p-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-8 bg-muted rounded w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-6 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={refresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              Weekly Insights
            </h2>
          </div>
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No session data yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              No session data for this week. Start a session to see your trends — daily patterns, optimal timing, and activity insights will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { overallStats, dayPatterns, hourPatterns, currentWeekTrend, previousWeekTrend, musicTimingInsights } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Weekly Insights
          </h2>
          <p className="text-muted-foreground">
            Patterns and optimal timing for your music sessions
          </p>
        </div>
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Sessions This Week"
          value={overallStats.totalSessionsThisWeek}
          subtitle={`${overallStats.totalMinutesThisWeek} minutes`}
          icon={<Activity className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title="Average Flow Score"
          value={`${overallStats.avgFlowScoreThisWeek}%`}
          icon={<Zap className="h-5 w-5 text-primary" />}
          trend={overallStats.weekOverWeekChange}
          trendLabel="vs last week"
        />
        <StatCard
          title="Current Streak"
          value={`${overallStats.streakDays} days`}
          subtitle="Keep it going!"
          icon={<Flame className="h-5 w-5 text-orange-500" />}
        />
        <StatCard
          title="Most Active Day"
          value={overallStats.mostActiveDay}
          subtitle={`Least: ${overallStats.leastActiveDay}`}
          icon={<Calendar className="h-5 w-5 text-primary" />}
        />
      </div>

      <Tabs defaultValue="patterns" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="patterns">Daily Patterns</TabsTrigger>
          <TabsTrigger value="timing">Optimal Timing</TabsTrigger>
          <TabsTrigger value="activities">Activity Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="patterns" className="space-y-4 mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <DayPatternChart data={dayPatterns} />
            <WeeklyComparison current={currentWeekTrend} previous={previousWeekTrend} />
          </div>
        </TabsContent>

        <TabsContent value="timing" className="space-y-4 mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <HourlyHeatmap data={hourPatterns} />
            <PeakPerformanceWindows dayPatterns={dayPatterns} hourPatterns={hourPatterns} />
          </div>
        </TabsContent>

        <TabsContent value="activities" className="space-y-4 mt-4">
          <MusicTimingInsights insights={musicTimingInsights} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

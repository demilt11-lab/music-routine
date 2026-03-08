import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Target,
  Zap,
  Clock,
  Activity,
  Music,
  Brain,
  Flame,
  Star,
  Award,
  RefreshCw,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useMonthlyProgress, MonthlyProgressData } from "@/hooks/useMonthlyProgress";

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend,
  trendLabel 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
}) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {trend !== undefined && (
              <div className="flex items-center gap-1 text-xs">
                {trend > 0 ? (
                  <ArrowUp className="h-3 w-3 text-green-500" />
                ) : trend < 0 ? (
                  <ArrowDown className="h-3 w-3 text-red-500" />
                ) : (
                  <Minus className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={trend > 0 ? "text-green-500" : trend < 0 ? "text-red-500" : "text-muted-foreground"}>
                  {trend > 0 ? "+" : ""}{trend}% {trendLabel}
                </span>
              </div>
            )}
          </div>
          <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyProgressChart({ data }: { data: MonthlyProgressData["weeklySummaries"] }) {
  const chartData = data.map((week, idx) => ({
    week: `Week ${idx + 1}`,
    sessions: week.totalSessions,
    minutes: week.totalMinutes,
    flowScore: week.avgFlowScore,
  }));

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Weekly Progress
        </CardTitle>
        <CardDescription>Session activity and flow scores over 4 weeks</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="sessions"
              name="Sessions"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary) / 0.3)"
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="flowScore"
              name="Flow Score %"
              stroke="hsl(var(--chart-2))"
              fill="hsl(var(--chart-2) / 0.3)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function FlowProgressChart({ data }: { data: MonthlyProgressData["flowProgress"] }) {
  const chartData = [1, 2, 3, 4].map(week => {
    const point: Record<string, any> = { week: `Week ${week}` };
    data.forEach(metric => {
      point[metric.metric] = metric.weeklyValues[week - 1] || 0;
    });
    return point;
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Flow State Progress
        </CardTitle>
        <CardDescription>Mental state metrics over time</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="Flow Score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
            <Line type="monotone" dataKey="Focus Score" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ fill: "hsl(var(--chart-2))" }} />
            <Line type="monotone" dataKey="Relaxation Score" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ fill: "hsl(var(--chart-3))" }} />
          </LineChart>
        </ResponsiveContainer>
        
        <div className="grid grid-cols-3 gap-4">
          {data.map(metric => (
            <div key={metric.metric} className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{metric.metric}</span>
                {getTrendIcon(metric.trend)}
              </div>
              <div className="text-2xl font-bold">{metric.currentWeek}%</div>
              <div className="text-xs text-muted-foreground">
                {metric.improvement > 0 ? "+" : ""}{metric.improvement}% from start
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MusicPreferenceTrends({ data }: { data: MonthlyProgressData["musicPreferenceTrends"] }) {
  const getTrendBadge = (direction: string) => {
    switch (direction) {
      case "increasing":
        return <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30"><TrendingUp className="h-3 w-3 mr-1" /> Increasing</Badge>;
      case "decreasing":
        return <Badge variant="default" className="bg-red-500/20 text-red-400 border-red-500/30"><TrendingDown className="h-3 w-3 mr-1" /> Decreasing</Badge>;
      default:
        return <Badge variant="secondary"><Minus className="h-3 w-3 mr-1" /> Stable</Badge>;
    }
  };

  if (data.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-8 text-center text-muted-foreground">
          No music preference data available yet
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {data.slice(0, 4).map(activity => {
        const chartData = activity.weeks.map((week, idx) => ({
          week: `W${idx + 1}`,
          tempo: week.avgTempo,
          energy: week.avgEnergy,
          valence: week.avgValence,
        }));

        return (
          <Card key={activity.activity} className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" />
                {activity.activity}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="tempo" name="Tempo" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="energy" name="Energy %" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tempo</span>
                    {getTrendBadge(activity.overallTrend.tempoDirection)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Energy</span>
                    {getTrendBadge(activity.overallTrend.energyDirection)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Mood (Valence)</span>
                    {getTrendBadge(activity.overallTrend.valenceDirection)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ActivityProgressView({ data }: { data: MonthlyProgressData["activityProgress"] }) {
  if (data.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-8 text-center text-muted-foreground">
          No activity progress data available yet
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.slice(0, 4).map(activity => {
        const chartData = activity.sessionsOverTime.map((_, idx) => ({
          week: `W${idx + 1}`,
          sessions: activity.sessionsOverTime[idx],
          flow: activity.flowScoresOverTime[idx],
          minutes: activity.minutesOverTime[idx],
        }));

        return (
          <Card key={activity.activity} className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{activity.activity}</CardTitle>
                <Badge 
                  variant={activity.improvement > 0 ? "default" : activity.improvement < 0 ? "destructive" : "secondary"}
                  className={activity.improvement > 0 ? "bg-green-500/20 text-green-400 border-green-500/30" : ""}
                >
                  {activity.improvement > 0 ? "+" : ""}{activity.improvement}% flow
                </Badge>
              </div>
              <CardDescription>Most improved: {activity.mostImprovedMetric}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="flow"
                    name="Flow %"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.3)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MilestonesList({ milestones }: { milestones: MonthlyProgressData["milestones"] }) {
  const getMilestoneIcon = (type: string) => {
    switch (type) {
      case "streak": return <Flame className="h-5 w-5 text-orange-500" />;
      case "flow_peak": return <Zap className="h-5 w-5 text-yellow-500" />;
      case "session_count": return <Target className="h-5 w-5 text-blue-500" />;
      case "consistency": return <Calendar className="h-5 w-5 text-green-500" />;
      case "improvement": return <TrendingUp className="h-5 w-5 text-purple-500" />;
      default: return <Star className="h-5 w-5 text-primary" />;
    }
  };

  if (milestones.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-8 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Keep listening to unlock milestones!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Monthly Milestones
        </CardTitle>
        <CardDescription>Achievements unlocked this month</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {milestones.map((milestone, idx) => (
            <div 
              key={idx} 
              className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg border border-border/30"
            >
              <div className="p-2 bg-primary/10 rounded-lg">
                {getMilestoneIcon(milestone.type)}
              </div>
              <div className="flex-1">
                <p className="font-medium">{milestone.title}</p>
                <p className="text-sm text-muted-foreground">{milestone.description}</p>
              </div>
              <Award className="h-5 w-5 text-yellow-500" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MonthOverMonthComparison({ data }: { data: MonthlyProgressData["monthOverMonthComparison"] }) {
  if (!data) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-6 text-center text-muted-foreground">
          Need more data for month-over-month comparison
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { label: "Sessions", value: data.sessionsChange, icon: <Activity className="h-4 w-4" /> },
    { label: "Minutes", value: data.minutesChange, icon: <Clock className="h-4 w-4" /> },
    { label: "Flow Score", value: data.flowChange, icon: <Brain className="h-4 w-4" />, isAbsolute: true },
    { label: "Consistency", value: data.consistencyChange, icon: <Target className="h-4 w-4" />, isAbsolute: true },
  ];

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          vs Previous Month
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {metrics.map(metric => (
            <div key={metric.label} className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                {metric.icon}
                <span className="text-sm">{metric.label}</span>
              </div>
              <div className={`text-xl font-bold flex items-center gap-1 ${
                metric.value > 0 ? "text-green-500" : metric.value < 0 ? "text-red-500" : "text-muted-foreground"
              }`}>
                {metric.value > 0 ? <TrendingUp className="h-4 w-4" /> : metric.value < 0 ? <TrendingDown className="h-4 w-4" /> : null}
                {metric.value > 0 ? "+" : ""}{metric.value}{metric.isAbsolute ? "" : "%"}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function MonthlyProgressReport() {
  const { data, isLoading, error, refresh } = useMonthlyProgress();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Monthly Progress</h2>
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
              <Calendar className="h-6 w-6 text-primary" />
              Monthly Progress Report
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
            <h3 className="text-lg font-semibold mb-2">No monthly data yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Complete sessions this month to see your progress. Weekly summaries, flow trends, and activity insights will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { overallStats, weeklySummaries, flowProgress, musicPreferenceTrends, activityProgress, milestones, monthOverMonthComparison } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Monthly Progress Report
          </h2>
          <p className="text-muted-foreground">
            Long-term patterns and improvements over 4 weeks
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
          title="Total Sessions"
          value={overallStats.totalSessions}
          subtitle={`${overallStats.totalMinutes} minutes total`}
          icon={<Activity className="h-5 w-5 text-primary" />}
          trend={monthOverMonthComparison?.sessionsChange}
          trendLabel="vs last month"
        />
        <StatCard
          title="Average Flow Score"
          value={`${overallStats.avgFlowScore}%`}
          icon={<Zap className="h-5 w-5 text-primary" />}
          trend={overallStats.flowImprovement}
          trendLabel="improvement"
        />
        <StatCard
          title="Active Days"
          value={overallStats.activeDays}
          subtitle={`${overallStats.longestStreak} day streak`}
          icon={<Flame className="h-5 w-5 text-orange-500" />}
        />
        <StatCard
          title="Consistency Score"
          value={`${overallStats.consistencyScore}%`}
          subtitle={`Best: Week ${overallStats.mostProductiveWeek}`}
          icon={<Target className="h-5 w-5 text-primary" />}
        />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="flow">Flow Progress</TabsTrigger>
          <TabsTrigger value="music">Music Trends</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <WeeklyProgressChart data={weeklySummaries} />
            <div className="space-y-4">
              <MilestonesList milestones={milestones} />
              <MonthOverMonthComparison data={monthOverMonthComparison} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="flow" className="space-y-4 mt-4">
          <FlowProgressChart data={flowProgress} />
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Best Flow Day</p>
                <p className="text-xl font-bold">{overallStats.bestFlowDay}</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Peak Hour</p>
                <p className="text-xl font-bold">
                  {overallStats.bestFlowHour}:00 - {(overallStats.bestFlowHour + 1) % 24}:00
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Top Activity</p>
                <p className="text-xl font-bold">{overallStats.topActivity}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="music" className="space-y-4 mt-4">
          <MusicPreferenceTrends data={musicPreferenceTrends} />
        </TabsContent>

        <TabsContent value="activities" className="space-y-4 mt-4">
          <ActivityProgressView data={activityProgress} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

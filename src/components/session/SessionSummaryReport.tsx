import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Activity, Music, TrendingUp, TrendingDown, Heart, Brain, 
  Clock, Zap, Target, Award, ChevronUp, ChevronDown, Minus,
  Sparkles, BarChart3, Download, Share2
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ShareSessionButton } from './ShareSessionButton';

interface BiometricSnapshot {
  timestamp: Date;
  heartRate: number;
  focusScore: number;
  relaxationScore: number;
  stressLevel: number;
}

interface MusicAdaptation {
  timestamp: Date;
  trackName: string;
  artist: string;
  tempo: number;
  energy: number;
  reason: string;
  triggerType: 'biometric' | 'goal' | 'manual' | 'auto';
  biometricTrigger?: {
    metric: string;
    previousValue: number;
    currentValue: number;
    direction: 'up' | 'down' | 'stable';
  };
}

interface SessionSummaryReportProps {
  sessionDuration: number; // seconds
  activityName: string;
  moodBefore: string;
  moodAfter: string;
  biometricHistory: BiometricSnapshot[];
  musicAdaptations: MusicAdaptation[];
  flowGoal?: { targetScore: number; achieved: boolean };
  onClose?: () => void;
  onStartNewSession?: () => void;
}

export const SessionSummaryReport: React.FC<SessionSummaryReportProps> = ({
  sessionDuration,
  activityName,
  moodBefore,
  moodAfter,
  biometricHistory,
  musicAdaptations,
  flowGoal,
  onClose,
  onStartNewSession,
}) => {
  // Calculate summary statistics
  const stats = React.useMemo(() => {
    if (biometricHistory.length === 0) {
      return {
        avgHeartRate: 0,
        avgFocus: 0,
        avgRelaxation: 0,
        avgStress: 0,
        peakFlow: 0,
        timeInFlow: 0,
        flowPercentage: 0,
        heartRateTrend: 'stable' as const,
        focusTrend: 'stable' as const,
        stressTrend: 'stable' as const,
      };
    }

    const avgHeartRate = biometricHistory.reduce((sum, b) => sum + b.heartRate, 0) / biometricHistory.length;
    const avgFocus = biometricHistory.reduce((sum, b) => sum + b.focusScore, 0) / biometricHistory.length;
    const avgRelaxation = biometricHistory.reduce((sum, b) => sum + b.relaxationScore, 0) / biometricHistory.length;
    const avgStress = biometricHistory.reduce((sum, b) => sum + b.stressLevel, 0) / biometricHistory.length;

    // Flow score = (focus + relaxation) / 2, in flow when > 60
    const flowScores = biometricHistory.map(b => (b.focusScore + b.relaxationScore) / 2);
    const peakFlow = Math.max(...flowScores);
    const timeInFlow = flowScores.filter(f => f >= 60).length;
    const flowPercentage = (timeInFlow / flowScores.length) * 100;

    // Calculate trends (compare first quarter to last quarter)
    const quarterLength = Math.floor(biometricHistory.length / 4);
    const firstQuarter = biometricHistory.slice(0, quarterLength);
    const lastQuarter = biometricHistory.slice(-quarterLength);

    const getTrend = (values: number[], key: keyof BiometricSnapshot): 'up' | 'down' | 'stable' => {
      if (values.length < 2) return 'stable';
      const first = firstQuarter.reduce((sum, b) => sum + (b[key] as number), 0) / firstQuarter.length;
      const last = lastQuarter.reduce((sum, b) => sum + (b[key] as number), 0) / lastQuarter.length;
      const diff = last - first;
      if (Math.abs(diff) < 5) return 'stable';
      return diff > 0 ? 'up' : 'down';
    };

    return {
      avgHeartRate: Math.round(avgHeartRate),
      avgFocus: Math.round(avgFocus),
      avgRelaxation: Math.round(avgRelaxation),
      avgStress: Math.round(avgStress),
      peakFlow: Math.round(peakFlow),
      timeInFlow,
      flowPercentage: Math.round(flowPercentage),
      heartRateTrend: getTrend(biometricHistory.map(b => b.heartRate), 'heartRate'),
      focusTrend: getTrend(biometricHistory.map(b => b.focusScore), 'focusScore'),
      stressTrend: getTrend(biometricHistory.map(b => b.stressLevel), 'stressLevel'),
    };
  }, [biometricHistory]);

  // Prepare chart data
  const chartData = biometricHistory.map((snapshot, index) => ({
    time: format(new Date(snapshot.timestamp), 'HH:mm'),
    index,
    heartRate: snapshot.heartRate,
    focus: snapshot.focusScore,
    relaxation: snapshot.relaxationScore,
    stress: snapshot.stressLevel,
    flow: (snapshot.focusScore + snapshot.relaxationScore) / 2,
  }));

  // Adaptation type distribution
  const adaptationTypes = musicAdaptations.reduce((acc, m) => {
    acc[m.triggerType] = (acc[m.triggerType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(adaptationTypes).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const COLORS = ['hsl(var(--primary))', 'hsl(45, 93%, 47%)', 'hsl(199, 89%, 48%)', 'hsl(var(--muted-foreground))'];

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const getMoodImprovement = () => {
    const moodScale: Record<string, number> = {
      terrible: 1, bad: 2, neutral: 3, good: 4, great: 5
    };
    const before = moodScale[moodBefore] || 3;
    const after = moodScale[moodAfter] || 3;
    return after - before;
  };

  const moodChange = getMoodImprovement();

  const TrendIcon = ({ trend, positive }: { trend: 'up' | 'down' | 'stable'; positive?: boolean }) => {
    if (trend === 'stable') return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (trend === 'up') {
      return positive 
        ? <ChevronUp className="h-3 w-3 text-green-500" />
        : <ChevronUp className="h-3 w-3 text-red-500" />;
    }
    return positive 
      ? <ChevronDown className="h-3 w-3 text-red-500" />
      : <ChevronDown className="h-3 w-3 text-green-500" />;
  };

  return (
    <Card className="bg-card/95 backdrop-blur border-border/50 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Session Summary
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 capitalize">
              {activityName} • {formatDuration(sessionDuration)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ShareSessionButton
              activityName={activityName}
              durationSeconds={sessionDuration}
              avgHeartRate={stats.avgHeartRate}
              flowPercentage={stats.flowPercentage}
            />
            <Button variant="outline" size="sm" className="touch-manipulation min-h-[44px]">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-4">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{stats.peakFlow}%</div>
            <div className="text-xs text-muted-foreground">Peak Flow</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.flowPercentage}%</div>
            <div className="text-xs text-muted-foreground">Time in Flow</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{musicAdaptations.length}</div>
            <div className="text-xs text-muted-foreground">Music Adaptations</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className={cn(
              "text-2xl font-bold",
              moodChange > 0 ? "text-green-500" : moodChange < 0 ? "text-red-500" : "text-muted-foreground"
            )}>
              {moodChange > 0 ? '+' : ''}{moodChange}
            </div>
            <div className="text-xs text-muted-foreground">Mood Change</div>
          </div>
        </div>

        {/* Flow Goal Achievement */}
        {flowGoal && (
          <div className={cn(
            "rounded-lg p-4 border",
            flowGoal.achieved 
              ? "bg-green-500/10 border-green-500/30" 
              : "bg-amber-500/10 border-amber-500/30"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className={cn("h-5 w-5", flowGoal.achieved ? "text-green-500" : "text-amber-500")} />
                <span className="font-medium">Flow Goal: {flowGoal.targetScore}%</span>
              </div>
              <Badge variant={flowGoal.achieved ? "default" : "secondary"}>
                {flowGoal.achieved ? (
                  <><Award className="h-3 w-3 mr-1" /> Achieved!</>
                ) : (
                  <>Peak: {stats.peakFlow}%</>
                )}
              </Badge>
            </div>
            <Progress 
              value={Math.min((stats.peakFlow / flowGoal.targetScore) * 100, 100)} 
              className="h-2 mt-2"
            />
          </div>
        )}

        {/* Biometric Trends Chart */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Biometric Trends
          </h4>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  domain={[0, 100]}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="flow" 
                  stroke="hsl(var(--primary))" 
                  fill="url(#flowGrad)"
                  strokeWidth={2}
                  name="Flow"
                />
                <Line 
                  type="monotone" 
                  dataKey="stress" 
                  stroke="hsl(0, 70%, 50%)" 
                  strokeWidth={1.5}
                  dot={false}
                  name="Stress"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
              <span className="text-sm flex items-center gap-2">
                <Heart className="h-3 w-3 text-red-400" />
                Avg Heart Rate
              </span>
              <span className="text-sm font-medium flex items-center gap-1">
                {stats.avgHeartRate} BPM
                <TrendIcon trend={stats.heartRateTrend} />
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
              <span className="text-sm flex items-center gap-2">
                <Brain className="h-3 w-3 text-purple-400" />
                Avg Focus
              </span>
              <span className="text-sm font-medium flex items-center gap-1">
                {stats.avgFocus}%
                <TrendIcon trend={stats.focusTrend} positive />
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
              <span className="text-sm flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-green-400" />
                Avg Relaxation
              </span>
              <span className="text-sm font-medium">{stats.avgRelaxation}%</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
              <span className="text-sm flex items-center gap-2">
                <Zap className="h-3 w-3 text-amber-400" />
                Avg Stress
              </span>
              <span className="text-sm font-medium flex items-center gap-1">
                {stats.avgStress}%
                <TrendIcon trend={stats.stressTrend} />
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Music Adaptations Summary */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Music className="h-4 w-4 text-primary" />
            Music Adaptations
          </h4>
          
          {musicAdaptations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Adaptation Type Distribution */}
              <div className="flex items-center justify-center">
                <div className="w-[140px] h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Adaptation Stats */}
              <div className="space-y-2">
                {pieData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      {item.name}
                    </span>
                    <Badge variant="outline">{item.value}</Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No music adaptations during this session
            </div>
          )}

          {/* Top Adaptations */}
          {musicAdaptations.length > 0 && (
            <ScrollArea className="h-[120px]">
              <div className="space-y-2">
                {musicAdaptations.slice(0, 5).map((adaptation, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-2 bg-muted/30 rounded text-sm"
                  >
                    <Badge variant="outline" className="text-[10px] px-1.5">
                      {adaptation.triggerType}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{adaptation.trackName}</p>
                      <p className="truncate text-xs text-muted-foreground">{adaptation.reason}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(adaptation.timestamp), 'HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {onClose && (
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
          )}
          {onStartNewSession && (
            <Button onClick={onStartNewSession} className="flex-1">
              <Sparkles className="h-4 w-4 mr-2" />
              New Session
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

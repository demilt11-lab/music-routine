import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';
import { Activity, Music, TrendingUp, TrendingDown, Minus, Clock, Zap, Heart, Brain } from 'lucide-react';
import { format } from 'date-fns';

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

interface TimelineEvent {
  timestamp: Date;
  type: 'biometric' | 'music' | 'goal' | 'milestone';
  data: BiometricSnapshot | MusicAdaptation | { message: string; icon: string };
}

interface AdaptiveTimelineProps {
  sessionId?: string;
  biometricHistory: BiometricSnapshot[];
  musicAdaptations: MusicAdaptation[];
  isLive?: boolean;
}

export const AdaptiveTimeline: React.FC<AdaptiveTimelineProps> = ({
  sessionId,
  biometricHistory = [],
  musicAdaptations = [],
  isLive = false
}) => {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  // Combine and sort all events chronologically
  const timelineEvents: TimelineEvent[] = [
    ...biometricHistory.map(b => ({ timestamp: b.timestamp, type: 'biometric' as const, data: b })),
    ...musicAdaptations.map(m => ({ timestamp: m.timestamp, type: 'music' as const, data: m }))
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Prepare chart data
  const chartData = biometricHistory.map((snapshot, index) => {
    const adaptationsAtTime = musicAdaptations.filter(m => {
      const mTime = new Date(m.timestamp).getTime();
      const sTime = new Date(snapshot.timestamp).getTime();
      const nextTime = biometricHistory[index + 1] 
        ? new Date(biometricHistory[index + 1].timestamp).getTime() 
        : sTime + 60000;
      return mTime >= sTime && mTime < nextTime;
    });

    return {
      time: format(new Date(snapshot.timestamp), 'HH:mm:ss'),
      timestamp: new Date(snapshot.timestamp).getTime(),
      heartRate: snapshot.heartRate,
      focus: snapshot.focusScore,
      relaxation: snapshot.relaxationScore,
      stress: snapshot.stressLevel,
      flowScore: Math.round((snapshot.focusScore + snapshot.relaxationScore - snapshot.stressLevel / 2) / 2),
      hasAdaptation: adaptationsAtTime.length > 0,
      adaptationCount: adaptationsAtTime.length
    };
  });

  // Find adaptation points for reference lines
  const adaptationPoints = musicAdaptations.map(m => ({
    timestamp: new Date(m.timestamp).getTime(),
    reason: m.reason,
    trackName: m.trackName
  }));

  const getTrendIcon = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up': return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'down': return <TrendingDown className="h-3 w-3 text-red-500" />;
      default: return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getTriggerColor = (type: MusicAdaptation['triggerType']) => {
    switch (type) {
      case 'biometric': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'goal': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'manual': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;

    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs text-muted-foreground mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Heart className="h-3 w-3 text-red-400" />
            <span className="text-xs">HR: {data.heartRate} BPM</span>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="h-3 w-3 text-purple-400" />
            <span className="text-xs">Focus: {data.focus}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3 text-green-400" />
            <span className="text-xs">Flow: {data.flowScore}%</span>
          </div>
          {data.hasAdaptation && (
            <div className="flex items-center gap-2 pt-1 border-t border-border mt-1">
              <Music className="h-3 w-3 text-primary" />
              <span className="text-xs text-primary">Music adapted!</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Adaptive Music Timeline
            {isLive && (
              <Badge variant="outline" className="ml-2 bg-green-500/20 text-green-400 border-green-500/30 animate-pulse">
                LIVE
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{biometricHistory.length} readings</span>
            <span>•</span>
            <span>{musicAdaptations.length} adaptations</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Biometric & Adaptation Chart */}
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
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
                axisLine={{ stroke: 'hsl(var(--border))' }}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Flow score area */}
              <Area
                type="monotone"
                dataKey="flowScore"
                stroke="hsl(var(--primary))"
                fill="url(#flowGradient)"
                strokeWidth={2}
              />
              
              {/* Focus line */}
              <Line
                type="monotone"
                dataKey="focus"
                stroke="hsl(280, 70%, 60%)"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="5 5"
              />
              
              {/* Stress line */}
              <Line
                type="monotone"
                dataKey="stress"
                stroke="hsl(0, 70%, 60%)"
                strokeWidth={1.5}
                dot={false}
                opacity={0.7}
              />

              {/* Adaptation markers */}
              {chartData.filter(d => d.hasAdaptation).map((point, i) => (
                <ReferenceLine
                  key={i}
                  x={point.time}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="3 3"
                  strokeWidth={2}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Chart Legend */}
        <div className="flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-primary/30 border border-primary" />
            <span className="text-muted-foreground">Flow Score</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-purple-500" style={{ borderStyle: 'dashed' }} />
            <span className="text-muted-foreground">Focus</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-red-500 opacity-70" />
            <span className="text-muted-foreground">Stress</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-0.5 h-3 bg-primary" style={{ borderStyle: 'dashed' }} />
            <span className="text-muted-foreground">Adaptation</span>
          </div>
        </div>

        {/* Adaptation Events Timeline */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            Music Adaptations
          </h4>
          <ScrollArea className="h-[200px] pr-4">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
              
              <div className="space-y-3">
                {musicAdaptations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No adaptations recorded yet
                  </div>
                ) : (
                  musicAdaptations.map((adaptation, index) => (
                    <div 
                      key={index} 
                      className="relative pl-8 group cursor-pointer"
                      onClick={() => setSelectedEvent({ 
                        timestamp: adaptation.timestamp, 
                        type: 'music', 
                        data: adaptation 
                      })}
                    >
                      {/* Timeline dot */}
                      <div className={`absolute left-1.5 top-1 w-3 h-3 rounded-full border-2 bg-card transition-colors ${
                        selectedEvent?.timestamp === adaptation.timestamp 
                          ? 'border-primary bg-primary' 
                          : 'border-primary/50 group-hover:border-primary'
                      }`} />
                      
                      <div className={`p-3 rounded-lg border transition-colors ${
                        selectedEvent?.timestamp === adaptation.timestamp
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-card/50 border-border/50 hover:bg-card'
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Music className="h-3 w-3 text-primary flex-shrink-0" />
                              <span className="text-sm font-medium truncate">{adaptation.trackName}</span>
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] px-1.5 py-0 ${getTriggerColor(adaptation.triggerType)}`}
                              >
                                {adaptation.triggerType}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{adaptation.artist}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {format(new Date(adaptation.timestamp), 'HH:mm:ss')}
                          </span>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {adaptation.reason}
                        </p>
                        
                        {adaptation.biometricTrigger && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                            <span className="text-[10px] text-muted-foreground">Trigger:</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {adaptation.biometricTrigger.metric}
                            </Badge>
                            <span className="text-[10px] flex items-center gap-1">
                              {adaptation.biometricTrigger.previousValue}
                              {getTrendIcon(adaptation.biometricTrigger.direction)}
                              {adaptation.biometricTrigger.currentValue}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {adaptation.tempo} BPM
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {Math.round(adaptation.energy * 100)}% energy
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Summary Stats */}
        {musicAdaptations.length > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/50">
            <div className="text-center">
              <p className="text-lg font-bold text-primary">
                {musicAdaptations.filter(m => m.triggerType === 'biometric').length}
              </p>
              <p className="text-[10px] text-muted-foreground">Biometric Triggers</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-400">
                {musicAdaptations.filter(m => m.triggerType === 'goal').length}
              </p>
              <p className="text-[10px] text-muted-foreground">Goal Adjustments</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-muted-foreground">
                {biometricHistory.length > 0 
                  ? Math.round((musicAdaptations.length / biometricHistory.length) * 100)
                  : 0}%
              </p>
              <p className="text-[10px] text-muted-foreground">Adaptation Rate</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

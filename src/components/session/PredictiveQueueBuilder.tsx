import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { 
  Clock, Zap, Target, RefreshCw, Play, ChevronRight, 
  Music, Activity, Brain, TrendingUp, Sparkles, ListMusic,
  Timer, Calendar
} from 'lucide-react';
import { usePredictiveQueue } from '@/hooks/usePredictiveQueue';
import { useJamendo, JamendoTrack } from '@/hooks/useJamendo';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PredictiveQueueBuilderProps {
  activityType: string;
  currentBiometrics: {
    focus: number;
    relaxation: number;
    stress: number;
    heartRate: number;
  };
  goalFlowScore?: number;
  onQueueReady?: (tracks: any[]) => void;
  isSessionActive?: boolean;
}

export const PredictiveQueueBuilder: React.FC<PredictiveQueueBuilderProps> = ({
  activityType,
  currentBiometrics,
  goalFlowScore = 70,
  onQueueReady,
  isSessionActive = false,
}) => {
  const [duration, setDuration] = useState(30);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [loadedSegments, setLoadedSegments] = useState<Set<number>>(new Set());
  
  const predictiveQueue = usePredictiveQueue();
  const jamendo = useJamendo();

  // Build queue when requested
  const handleBuildQueue = async () => {
    const segments = await predictiveQueue.buildQueue(
      duration,
      activityType,
      currentBiometrics,
      undefined,
      goalFlowScore
    );

    if (segments.length > 0) {
      // Load tracks for first segment immediately
      await loadTracksForSegment(0);
    }
  };

  // Load tracks for a specific segment
  const loadTracksForSegment = async (segmentIndex: number) => {
    const segment = predictiveQueue.state.segments[segmentIndex];
    if (!segment || loadedSegments.has(segmentIndex)) return;

    setIsLoadingTracks(true);
    
    try {
      const tracks = await jamendo.searchByTempoEnergy(
        segment.recommendedTempo,
        segment.recommendedEnergy,
        activityType
      );

      if (tracks.length > 0) {
        const queuedTracks = tracks.slice(0, 3).map((track: JamendoTrack) => ({
          id: track.id,
          title: track.name,
          artist: track.artist_name,
          tempo: segment.recommendedTempo,
          energy: segment.recommendedEnergy,
          audioUrl: track.audio,
          source: 'jamendo' as const,
          reason: segment.reason,
          segment: segmentIndex,
        }));

        predictiveQueue.addTracksToSegment(segmentIndex, queuedTracks);
        setLoadedSegments(prev => new Set([...prev, segmentIndex]));
      }
    } catch (error) {
      console.error('Error loading tracks for segment:', error);
    } finally {
      setIsLoadingTracks(false);
    }
  };

  // Auto-load next segment when approaching end of current
  useEffect(() => {
    if (!isAutoMode || !isSessionActive) return;

    const currentSegment = predictiveQueue.state.currentSegment;
    const nextSegment = currentSegment + 1;

    if (nextSegment < predictiveQueue.state.segments.length && !loadedSegments.has(nextSegment)) {
      loadTracksForSegment(nextSegment);
    }
  }, [predictiveQueue.state.currentSegment, isAutoMode, isSessionActive]);

  // Prepare chart data for visualization
  const chartData = predictiveQueue.state.segments.map((segment, index) => ({
    segment: `${segment.startMinute}-${segment.endMinute}m`,
    index,
    focus: segment.predictedState.focus,
    relaxation: segment.predictedState.relaxation,
    stress: segment.predictedState.stress,
    flow: segment.predictedState.flow,
    tempo: segment.recommendedTempo,
    energy: segment.recommendedEnergy * 100,
    isCurrent: index === predictiveQueue.state.currentSegment,
  }));

  const currentSegment = predictiveQueue.state.segments[predictiveQueue.state.currentSegment];

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Predictive Queue Builder
            </CardTitle>
            <CardDescription>
              Auto-build a playlist based on predicted biometric needs
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            <Timer className="h-3 w-3 mr-1" />
            {duration} min
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Duration & Settings */}
        {predictiveQueue.state.segments.length === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Session Duration</Label>
                <span className="text-sm font-medium">{duration} minutes</span>
              </div>
              <Slider
                value={[duration]}
                onValueChange={([v]) => setDuration(v)}
                min={10}
                max={60}
                step={5}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>10 min</span>
                <span>30 min</span>
                <span>60 min</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <Label htmlFor="auto-mode" className="text-sm cursor-pointer">
                  Auto-load tracks
                </Label>
              </div>
              <Switch
                id="auto-mode"
                checked={isAutoMode}
                onCheckedChange={setIsAutoMode}
              />
            </div>

            <div className="p-3 bg-muted/30 rounded-lg space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Current State
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Focus</span>
                  <span>{Math.round(currentBiometrics.focus)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Relaxation</span>
                  <span>{Math.round(currentBiometrics.relaxation)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stress</span>
                  <span>{Math.round(currentBiometrics.stress)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Heart Rate</span>
                  <span>{currentBiometrics.heartRate} BPM</span>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleBuildQueue} 
              className="w-full"
              disabled={predictiveQueue.state.isBuilding}
            >
              {predictiveQueue.state.isBuilding ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Building...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Build {duration}-Minute Queue
                </>
              )}
            </Button>
          </div>
        )}

        {/* Segments Visualization */}
        {predictiveQueue.state.segments.length > 0 && (
          <>
            {/* Predicted Flow Chart */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Predicted Flow Journey
              </h4>
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="predictedFlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="segment" 
                      tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                      domain={[0, 100]}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '11px'
                      }}
                    />
                    {goalFlowScore && (
                      <ReferenceLine 
                        y={goalFlowScore} 
                        stroke="hsl(45, 93%, 47%)" 
                        strokeDasharray="5 5" 
                        label={{ value: 'Goal', fontSize: 10, fill: 'hsl(45, 93%, 47%)' }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="flow"
                      stroke="hsl(var(--primary))"
                      fill="url(#predictedFlow)"
                      strokeWidth={2}
                      name="Flow"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Current Segment Info */}
            {currentSegment && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Current: {currentSegment.startMinute}-{currentSegment.endMinute} min
                  </h4>
                  <Badge variant="outline">
                    Segment {predictiveQueue.state.currentSegment + 1}/{predictiveQueue.state.segments.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Predicted Flow:</span>
                    <span className="ml-1 font-medium">{currentSegment.predictedState.flow}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Target Tempo:</span>
                    <span className="ml-1 font-medium">{currentSegment.recommendedTempo} BPM</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">{currentSegment.reason}</p>
              </div>
            )}

            {/* Segment List */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <ListMusic className="h-4 w-4" />
                Queue Segments
              </h4>
              <ScrollArea className="h-[180px] pr-2">
                <div className="space-y-2">
                  {predictiveQueue.state.segments.map((segment, index) => {
                    const segmentTracks = predictiveQueue.getSegmentTracks(index);
                    const isCurrentSegment = index === predictiveQueue.state.currentSegment;
                    const isLoaded = loadedSegments.has(index);

                    return (
                      <div
                        key={index}
                        className={cn(
                          "p-2 rounded-lg border transition-colors",
                          isCurrentSegment 
                            ? "bg-primary/10 border-primary/30" 
                            : "bg-muted/30 border-border/50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium flex items-center gap-1">
                            {isCurrentSegment && <Play className="h-3 w-3 text-primary" />}
                            {segment.startMinute}-{segment.endMinute} min
                          </span>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px] px-1">
                              {segment.recommendedTempo} BPM
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1">
                              {Math.round(segment.recommendedEnergy * 100)}% energy
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
                          <span>Flow: {segment.predictedState.flow}%</span>
                          <span>•</span>
                          <span>Focus: {segment.predictedState.focus}%</span>
                          <span>•</span>
                          <span>Stress: {segment.predictedState.stress}%</span>
                        </div>

                        {isLoaded && segmentTracks.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {segmentTracks.map((track, ti) => (
                              <Badge key={ti} variant="secondary" className="text-[10px]">
                                <Music className="h-2 w-2 mr-1" />
                                {track.title.slice(0, 15)}...
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] mt-1"
                            onClick={() => loadTracksForSegment(index)}
                            disabled={isLoadingTracks}
                          >
                            {isLoadingTracks ? (
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <ChevronRight className="h-3 w-3 mr-1" />
                            )}
                            Load tracks
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  predictiveQueue.clearQueue();
                  setLoadedSegments(new Set());
                }}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Rebuild
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const allTracks = predictiveQueue.state.predictedQueue;
                  onQueueReady?.(allTracks);
                  toast.success(`Added ${allTracks.length} tracks to queue`);
                }}
                className="flex-1"
                disabled={predictiveQueue.state.predictedQueue.length === 0}
              >
                <Play className="h-4 w-4 mr-1" />
                Start Playback
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useJamendo, JamendoTrack } from "@/hooks/useJamendo";
import { useBiometricTracking, BiometricReading } from "@/hooks/useBiometricTracking";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Sparkles, Play, Pause, Music2, Zap, Target, RefreshCw,
  Moon, Dumbbell, BookOpen, Coffee, Car, Heart, Brain,
  TrendingUp, Plus, ListMusic, Activity, Gauge, Timer,
  ArrowUp, ArrowDown, Minus, AlertCircle, CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OptimalCharacteristics {
  tempo: { min: number; max: number; optimal: number };
  energy: { min: number; max: number; optimal: number };
  valence: { min: number; max: number; optimal: number };
  danceability: { min: number; max: number; optimal: number };
}

interface ActivityProfile {
  activityId: string;
  activityName: string;
  sessionCount: number;
  avgFlowScore: number;
  characteristics: OptimalCharacteristics;
}

interface RecommendedTrack extends JamendoTrack {
  matchScore: number;
  matchReasons: string[];
  biometricAdjusted?: boolean;
}

interface FlowGoal {
  targetScore: number;
  isActive: boolean;
  currentProgress: number;
}

interface BiometricAdjustment {
  tempoModifier: number;
  energyModifier: number;
  reason: string;
  urgency: "low" | "medium" | "high";
}

const activityIcons: Record<string, React.ReactNode> = {
  sleep: <Moon className="w-4 h-4" />,
  workout: <Dumbbell className="w-4 h-4" />,
  study: <BookOpen className="w-4 h-4" />,
  relax: <Coffee className="w-4 h-4" />,
  commute: <Car className="w-4 h-4" />,
  meditation: <Brain className="w-4 h-4" />,
};

function calculateBiometricAdjustment(
  currentReading: BiometricReading | null,
  targetFlowScore: number,
  activityType: string
): BiometricAdjustment {
  if (!currentReading) {
    return { tempoModifier: 0, energyModifier: 0, reason: "No biometric data", urgency: "low" };
  }

  const currentFlow = (currentReading.focusScore + currentReading.relaxationScore) / 2;
  const flowGap = targetFlowScore - currentFlow;
  
  let tempoModifier = 0;
  let energyModifier = 0;
  let reason = "";
  let urgency: "low" | "medium" | "high" = "low";

  // High stress - need calmer music
  if (currentReading.stressLevel > 60) {
    tempoModifier = -15;
    energyModifier = -0.2;
    reason = "High stress detected - calming music recommended";
    urgency = "high";
  }
  // Low focus - need more engaging music
  else if (currentReading.focusScore < 40 && activityType.toLowerCase() !== "sleep") {
    tempoModifier = 10;
    energyModifier = 0.15;
    reason = "Low focus - more engaging music to boost concentration";
    urgency = "medium";
  }
  // Very relaxed but need focus (for work activities)
  else if (currentReading.relaxationScore > 70 && currentReading.focusScore < 50 && 
           ["study", "workout", "commute"].includes(activityType.toLowerCase())) {
    tempoModifier = 15;
    energyModifier = 0.2;
    reason = "Too relaxed for task - energizing music recommended";
    urgency = "medium";
  }
  // Good state but not in flow yet
  else if (flowGap > 20) {
    tempoModifier = flowGap > 30 ? 10 : 5;
    energyModifier = flowGap > 30 ? 0.1 : 0.05;
    reason = "Optimizing for flow state";
    urgency = "low";
  }
  // Already in flow - maintain
  else if (flowGap <= 10 && flowGap >= -10) {
    tempoModifier = 0;
    energyModifier = 0;
    reason = "Flow state achieved - maintaining current style";
    urgency = "low";
  }
  // Overshooting flow - slightly calm down
  else if (flowGap < -20) {
    tempoModifier = -5;
    energyModifier = -0.1;
    reason = "Optimizing to sustain flow state";
    urgency = "low";
  }

  return { tempoModifier, energyModifier, reason, urgency };
}

export function RecommendationEngine() {
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedTrack[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [queue, setQueue] = useState<RecommendedTrack[]>([]);
  
  // Real-time biometric integration
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(false);
  const [biometricAdjustment, setBiometricAdjustment] = useState<BiometricAdjustment | null>(null);
  const realTimeInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Goal setting
  const [flowGoal, setFlowGoal] = useState<FlowGoal>({
    targetScore: 75,
    isActive: false,
    currentProgress: 0,
  });
  
  const jamendo = useJamendo();
  const biometricTracking = useBiometricTracking();

  // Calculate activity profiles from historical data
  const loadActivityProfiles = useCallback(async () => {
    setIsLoadingProfiles(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: sessions } = await supabase
        .from("listening_sessions")
        .select(`
          *,
          activity_types(id, name),
          session_songs(
            songs(id, title, artist, tempo, energy, valence, danceability)
          )
        `)
        .eq("user_id", user.id);

      const { data: biometrics } = await supabase
        .from("biometric_readings")
        .select("*")
        .eq("user_id", user.id);

      if (!sessions?.length) {
        setProfiles([]);
        return;
      }

      const activityMap = new Map<string, {
        activityName: string;
        sessions: typeof sessions;
        songs: any[];
        flowScores: number[];
      }>();

      sessions.forEach((session) => {
        const activityId = session.activity_type_id;
        const activityName = session.activity_types?.name || "unknown";
        
        if (!activityMap.has(activityId)) {
          activityMap.set(activityId, { 
            activityName,
            sessions: [], 
            songs: [],
            flowScores: [],
          });
        }
        
        const entry = activityMap.get(activityId)!;
        entry.sessions.push(session);

        const sessionBiometrics = biometrics?.filter(b => b.session_id === session.id) || [];
        if (sessionBiometrics.length > 0) {
          const avgFocus = sessionBiometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / sessionBiometrics.length;
          const avgRelax = sessionBiometrics.reduce((sum, b) => sum + (b.relaxation_score || 0), 0) / sessionBiometrics.length;
          const flowScore = (avgFocus + avgRelax) / 2;
          
          session.session_songs?.forEach((ss: any) => {
            if (ss.songs) {
              entry.songs.push({ ...ss.songs, flowScore });
              entry.flowScores.push(flowScore);
            }
          });
        }
      });

      const calculatedProfiles: ActivityProfile[] = [];
      
      activityMap.forEach((data, activityId) => {
        if (data.songs.length === 0) return;

        const songs = data.songs;
        const avgFlowScore = data.flowScores.length > 0 
          ? data.flowScores.reduce((a, b) => a + b, 0) / data.flowScores.length 
          : 50;

        const totalWeight = songs.reduce((sum, s) => sum + (s.flowScore || 50), 0);
        
        const optimalTempo = songs.reduce((sum, s) => sum + (s.tempo || 100) * (s.flowScore || 50), 0) / totalWeight;
        const optimalEnergy = songs.reduce((sum, s) => sum + (s.energy || 0.5) * (s.flowScore || 50), 0) / totalWeight;
        const optimalValence = songs.reduce((sum, s) => sum + (s.valence || 0.5) * (s.flowScore || 50), 0) / totalWeight;
        const optimalDanceability = songs.reduce((sum, s) => sum + (s.danceability || 0.5) * (s.flowScore || 50), 0) / totalWeight;

        const tempos = songs.map(s => s.tempo).filter(Boolean) as number[];
        const energies = songs.map(s => s.energy).filter(Boolean) as number[];
        const valences = songs.map(s => s.valence).filter(Boolean) as number[];
        const danceabilities = songs.map(s => s.danceability).filter(Boolean) as number[];

        calculatedProfiles.push({
          activityId,
          activityName: data.activityName,
          sessionCount: data.sessions.length,
          avgFlowScore,
          characteristics: {
            tempo: {
              min: tempos.length ? Math.min(...tempos) : 80,
              max: tempos.length ? Math.max(...tempos) : 140,
              optimal: Math.round(optimalTempo) || 110,
            },
            energy: {
              min: energies.length ? Math.min(...energies) : 0.3,
              max: energies.length ? Math.max(...energies) : 0.8,
              optimal: optimalEnergy || 0.5,
            },
            valence: {
              min: valences.length ? Math.min(...valences) : 0.3,
              max: valences.length ? Math.max(...valences) : 0.8,
              optimal: optimalValence || 0.5,
            },
            danceability: {
              min: danceabilities.length ? Math.min(...danceabilities) : 0.3,
              max: danceabilities.length ? Math.max(...danceabilities) : 0.7,
              optimal: optimalDanceability || 0.5,
            },
          },
        });
      });

      setProfiles(calculatedProfiles);
      
      if (calculatedProfiles.length > 0 && !selectedActivity) {
        setSelectedActivity(calculatedProfiles[0].activityId);
      }
    } catch (error) {
      console.error("Error loading profiles:", error);
      toast.error("Failed to load activity profiles");
    } finally {
      setIsLoadingProfiles(false);
    }
  }, [selectedActivity]);

  // Generate recommendations with optional biometric adjustments
  const generateRecommendations = useCallback(async (adjustment?: BiometricAdjustment) => {
    const profile = profiles.find(p => p.activityId === selectedActivity);
    if (!profile) return;

    setIsLoadingRecommendations(true);

    try {
      let { tempo, energy } = profile.characteristics;
      
      // Apply biometric adjustments if real-time mode is enabled
      let adjustedTempo = tempo.optimal;
      let adjustedEnergy = energy.optimal;
      
      if (adjustment && isRealTimeEnabled) {
        adjustedTempo = Math.max(60, Math.min(180, tempo.optimal + adjustment.tempoModifier));
        adjustedEnergy = Math.max(0, Math.min(1, energy.optimal + adjustment.energyModifier));
      }
      
      // Apply goal-based adjustments
      if (flowGoal.isActive) {
        const currentReading = biometricTracking.state.currentReading;
        if (currentReading) {
          const currentFlow = (currentReading.focusScore + currentReading.relaxationScore) / 2;
          const goalGap = flowGoal.targetScore - currentFlow;
          
          // Adjust based on how far from goal
          if (goalGap > 15) {
            adjustedTempo += 5;
            adjustedEnergy += 0.1;
          } else if (goalGap < -15) {
            adjustedTempo -= 5;
            adjustedEnergy -= 0.1;
          }
        }
      }

      const tracks = await jamendo.searchByTempoEnergy(
        adjustedTempo,
        adjustedEnergy,
        profile.activityName
      );

      const scoredTracks: RecommendedTrack[] = tracks.map(track => {
        const matchReasons: string[] = [];
        let matchScore = 0;

        const estimatedTempo = track.duration < 180 ? 130 : track.duration < 240 ? 110 : 90;
        const tempoMatch = 100 - Math.abs(estimatedTempo - adjustedTempo);
        if (tempoMatch > 80) {
          matchScore += 25;
          matchReasons.push("Tempo matches your flow zone");
        }

        if (adjustedEnergy > 0.5) {
          matchScore += 25;
          matchReasons.push("High energy for optimal focus");
        } else {
          matchScore += 20;
          matchReasons.push("Calm energy for relaxation");
        }

        if (profile.activityName.toLowerCase() === "study" || profile.activityName.toLowerCase() === "meditation") {
          matchScore += 15;
          matchReasons.push("Instrumental focus music");
        } else if (profile.activityName.toLowerCase() === "workout") {
          matchScore += 15;
          matchReasons.push("Energetic workout beats");
        } else {
          matchScore += 10;
          matchReasons.push(`Suited for ${profile.activityName}`);
        }

        // Biometric adjustment bonus
        if (adjustment && isRealTimeEnabled) {
          matchScore += 15;
          matchReasons.push("Biometrically optimized");
        }

        // Goal bonus
        if (flowGoal.isActive) {
          matchScore += 10;
          matchReasons.push(`Targeting ${flowGoal.targetScore}% flow`);
        }

        matchScore += 10;

        return {
          ...track,
          matchScore: Math.min(matchScore, 100),
          matchReasons,
          biometricAdjusted: adjustment !== undefined && isRealTimeEnabled,
        };
      });

      scoredTracks.sort((a, b) => b.matchScore - a.matchScore);
      
      setRecommendations(scoredTracks);
      
      if (adjustment && isRealTimeEnabled) {
        toast.success(`Recommendations adjusted based on biometrics`, { duration: 2000 });
      } else {
        toast.success(`Found ${scoredTracks.length} recommendations for ${profile.activityName}`);
      }
    } catch (error) {
      console.error("Error generating recommendations:", error);
      toast.error("Failed to generate recommendations");
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [profiles, selectedActivity, jamendo, isRealTimeEnabled, flowGoal, biometricTracking.state.currentReading]);

  // Real-time biometric monitoring
  useEffect(() => {
    if (isRealTimeEnabled && selectedActivity) {
      const profile = profiles.find(p => p.activityId === selectedActivity);
      
      // Start biometric tracking if not already started
      if (!biometricTracking.state.isTracking) {
        biometricTracking.startTracking();
      }
      
      // Set up periodic checks
      realTimeInterval.current = setInterval(() => {
        const currentReading = biometricTracking.state.currentReading;
        if (currentReading && profile) {
          const adjustment = calculateBiometricAdjustment(
            currentReading,
            flowGoal.isActive ? flowGoal.targetScore : profile.avgFlowScore,
            profile.activityName
          );
          
          setBiometricAdjustment(adjustment);
          
          // Update flow goal progress
          if (flowGoal.isActive) {
            const currentFlow = (currentReading.focusScore + currentReading.relaxationScore) / 2;
            setFlowGoal(prev => ({ ...prev, currentProgress: currentFlow }));
          }
          
          // Auto-refresh recommendations if significant change detected
          if (adjustment.urgency === "high" || adjustment.urgency === "medium") {
            generateRecommendations(adjustment);
          }
        }
      }, 5000); // Check every 5 seconds
      
      return () => {
        if (realTimeInterval.current) {
          clearInterval(realTimeInterval.current);
        }
      };
    } else {
      if (realTimeInterval.current) {
        clearInterval(realTimeInterval.current);
      }
      setBiometricAdjustment(null);
    }
  }, [isRealTimeEnabled, selectedActivity, profiles, flowGoal.isActive, flowGoal.targetScore]);

  // Load profiles on mount
  useEffect(() => {
    loadActivityProfiles();
  }, [loadActivityProfiles]);

  // Generate recommendations when activity changes
  useEffect(() => {
    if (selectedActivity && profiles.length > 0) {
      generateRecommendations();
    }
  }, [selectedActivity, profiles]);

  const addToQueue = (track: RecommendedTrack) => {
    setQueue(prev => [...prev, track]);
    toast.success(`Added "${track.name}" to queue`);
  };

  const playTrack = (track: RecommendedTrack) => {
    jamendo.play(track);
  };

  const toggleRealTime = () => {
    setIsRealTimeEnabled(!isRealTimeEnabled);
    if (!isRealTimeEnabled) {
      toast.success("Real-time biometric mode enabled");
    } else {
      toast.info("Real-time mode disabled");
    }
  };

  const toggleFlowGoal = () => {
    setFlowGoal(prev => ({ ...prev, isActive: !prev.isActive }));
    if (!flowGoal.isActive) {
      toast.success(`Flow goal set: ${flowGoal.targetScore}%`);
    }
  };

  const selectedProfile = profiles.find(p => p.activityId === selectedActivity);
  const currentReading = biometricTracking.state.currentReading;
  const currentFlowScore = currentReading 
    ? Math.round((currentReading.focusScore + currentReading.relaxationScore) / 2)
    : 0;

  if (isLoadingProfiles) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (profiles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Smart Recommendations
          </CardTitle>
          <CardDescription>
            Personalized music suggestions based on your biometric data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Music2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No listening history yet</p>
            <p className="text-sm mt-2">
              Start a listening session to build your personalized recommendations
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Smart Recommendations
            </CardTitle>
            <CardDescription>
              AI-powered music suggestions optimized for your flow state
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => generateRecommendations(biometricAdjustment || undefined)}
              disabled={isLoadingRecommendations}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isLoadingRecommendations && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Real-Time & Goal Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Real-Time Biometric Mode */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <Label htmlFor="realtime-mode" className="font-medium">Real-Time Mode</Label>
              </div>
              <Switch
                id="realtime-mode"
                checked={isRealTimeEnabled}
                onCheckedChange={toggleRealTime}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically adjusts recommendations based on live biometric data
            </p>
            
            {isRealTimeEnabled && currentReading && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current Flow</span>
                  <Badge variant={currentFlowScore > 60 ? "default" : "secondary"}>
                    {currentFlowScore}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Heart Rate</span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3 text-red-500" />
                    {currentReading.heartRate} BPM
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Stress</span>
                  <Progress value={currentReading.stressLevel} className="w-20 h-2" />
                </div>
                
                {biometricAdjustment && (
                  <div className={cn(
                    "mt-2 p-2 rounded text-xs",
                    biometricAdjustment.urgency === "high" && "bg-destructive/10 text-destructive",
                    biometricAdjustment.urgency === "medium" && "bg-yellow-500/10 text-yellow-700",
                    biometricAdjustment.urgency === "low" && "bg-green-500/10 text-green-700"
                  )}>
                    <div className="flex items-center gap-1">
                      {biometricAdjustment.urgency === "high" && <AlertCircle className="w-3 h-3" />}
                      {biometricAdjustment.urgency === "medium" && <Gauge className="w-3 h-3" />}
                      {biometricAdjustment.urgency === "low" && <CheckCircle2 className="w-3 h-3" />}
                      {biometricAdjustment.reason}
                    </div>
                    {(biometricAdjustment.tempoModifier !== 0 || biometricAdjustment.energyModifier !== 0) && (
                      <div className="flex gap-2 mt-1 text-[10px]">
                        {biometricAdjustment.tempoModifier !== 0 && (
                          <span className="flex items-center gap-0.5">
                            Tempo: {biometricAdjustment.tempoModifier > 0 ? <ArrowUp className="w-2 h-2" /> : <ArrowDown className="w-2 h-2" />}
                            {Math.abs(biometricAdjustment.tempoModifier)} BPM
                          </span>
                        )}
                        {biometricAdjustment.energyModifier !== 0 && (
                          <span className="flex items-center gap-0.5">
                            Energy: {biometricAdjustment.energyModifier > 0 ? <ArrowUp className="w-2 h-2" /> : <ArrowDown className="w-2 h-2" />}
                            {Math.round(Math.abs(biometricAdjustment.energyModifier) * 100)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Flow Goal Setting */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <Label htmlFor="flow-goal" className="font-medium">Flow Goal</Label>
              </div>
              <Switch
                id="flow-goal"
                checked={flowGoal.isActive}
                onCheckedChange={toggleFlowGoal}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Set a target flow score and get music to achieve it
            </p>
            
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Target Score</span>
                <Badge variant="outline">{flowGoal.targetScore}%</Badge>
              </div>
              <Slider
                value={[flowGoal.targetScore]}
                onValueChange={([value]) => setFlowGoal(prev => ({ ...prev, targetScore: value }))}
                min={30}
                max={100}
                step={5}
                className="w-full"
                disabled={flowGoal.isActive}
              />
              
              {flowGoal.isActive && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">
                      {flowGoal.currentProgress.toFixed(0)}% / {flowGoal.targetScore}%
                    </span>
                  </div>
                  <Progress 
                    value={(flowGoal.currentProgress / flowGoal.targetScore) * 100} 
                    className="h-2"
                  />
                  <div className="flex items-center gap-1 text-xs">
                    {flowGoal.currentProgress >= flowGoal.targetScore ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span className="text-green-600">Goal achieved!</span>
                      </>
                    ) : flowGoal.currentProgress >= flowGoal.targetScore * 0.8 ? (
                      <>
                        <TrendingUp className="w-3 h-3 text-yellow-500" />
                        <span className="text-yellow-600">Almost there!</span>
                      </>
                    ) : (
                      <>
                        <Timer className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Building towards goal...</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Activity Selector */}
        <div className="flex flex-wrap gap-2">
          {profiles.map((profile) => {
            const icon = activityIcons[profile.activityName.toLowerCase()] || <Target className="w-4 h-4" />;
            const isSelected = profile.activityId === selectedActivity;
            
            return (
              <Button
                key={profile.activityId}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedActivity(profile.activityId)}
                className="gap-2"
              >
                {icon}
                {profile.activityName}
                <Badge variant="secondary" className="ml-1 text-xs">
                  {profile.sessionCount} sessions
                </Badge>
              </Button>
            );
          })}
        </div>

        {/* Optimal Characteristics Display */}
        {selectedProfile && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Gauge className="w-4 h-4 text-primary" />
                {isRealTimeEnabled ? "Adjusted Settings" : "Optimal Settings"} for {selectedProfile.activityName}
              </h4>
              <Badge variant="outline" className="text-xs">
                Avg Flow: {Math.round(selectedProfile.avgFlowScore)}%
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tempo</span>
                  <span className="font-medium">
                    {biometricAdjustment && isRealTimeEnabled 
                      ? Math.round(selectedProfile.characteristics.tempo.optimal + biometricAdjustment.tempoModifier)
                      : selectedProfile.characteristics.tempo.optimal} BPM
                  </span>
                </div>
                <Progress 
                  value={((biometricAdjustment && isRealTimeEnabled 
                    ? selectedProfile.characteristics.tempo.optimal + biometricAdjustment.tempoModifier
                    : selectedProfile.characteristics.tempo.optimal) - 60) / 1.2} 
                  className="h-2"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Energy</span>
                  <span className="font-medium">
                    {Math.round((biometricAdjustment && isRealTimeEnabled 
                      ? selectedProfile.characteristics.energy.optimal + biometricAdjustment.energyModifier
                      : selectedProfile.characteristics.energy.optimal) * 100)}%
                  </span>
                </div>
                <Progress 
                  value={(biometricAdjustment && isRealTimeEnabled 
                    ? selectedProfile.characteristics.energy.optimal + biometricAdjustment.energyModifier
                    : selectedProfile.characteristics.energy.optimal) * 100} 
                  className="h-2"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mood</span>
                  <span className="font-medium">{Math.round(selectedProfile.characteristics.valence.optimal * 100)}%</span>
                </div>
                <Progress 
                  value={selectedProfile.characteristics.valence.optimal * 100} 
                  className="h-2"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Danceability</span>
                  <span className="font-medium">{Math.round(selectedProfile.characteristics.danceability.optimal * 100)}%</span>
                </div>
                <Progress 
                  value={selectedProfile.characteristics.danceability.optimal * 100} 
                  className="h-2"
                />
              </div>
            </div>
          </div>
        )}

        {/* Recommendations List */}
        <Tabs defaultValue="recommendations" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recommendations" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Recommendations
              {isRealTimeEnabled && <Badge variant="secondary" className="text-[10px] px-1">LIVE</Badge>}
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-2">
              <ListMusic className="w-4 h-4" />
              Queue ({queue.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="recommendations" className="mt-4">
            {isLoadingRecommendations ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : recommendations.length > 0 ? (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {recommendations.map((track, index) => (
                    <div
                      key={track.id}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
                        track.biometricAdjusted && "border-primary/30"
                      )}
                    >
                      {/* Album Art */}
                      <div className="relative shrink-0">
                        <img
                          src={track.image || "/placeholder.svg"}
                          alt={track.name}
                          className="w-14 h-14 rounded-md object-cover"
                        />
                        <Badge 
                          className="absolute -top-2 -left-2 text-xs px-1.5"
                          variant={track.matchScore > 70 ? "default" : "secondary"}
                        >
                          {track.matchScore}%
                        </Badge>
                        {track.biometricAdjusted && (
                          <Activity className="absolute -bottom-1 -right-1 w-4 h-4 text-primary bg-background rounded-full p-0.5" />
                        )}
                      </div>
                      
                      {/* Track Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{track.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {track.artist_name}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {track.matchReasons.slice(0, 2).map((reason, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => addToQueue(track)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="default"
                          onClick={() => playTrack(track)}
                        >
                          {jamendo.currentTrack?.id === track.id && jamendo.isPlaying ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Music2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>No recommendations available</p>
                <p className="text-sm mt-1">Try selecting a different activity</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="queue" className="mt-4">
            {queue.length > 0 ? (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {queue.map((track, index) => (
                    <div
                      key={`${track.id}-${index}`}
                      className="flex items-center gap-3 p-2 rounded-lg border bg-card"
                    >
                      <span className="text-sm text-muted-foreground w-6">
                        {index + 1}
                      </span>
                      <img
                        src={track.image || "/placeholder.svg"}
                        alt={track.name}
                        className="w-10 h-10 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{track.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {track.artist_name}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => playTrack(track)}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ListMusic className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>Queue is empty</p>
                <p className="text-sm mt-1">Add tracks from recommendations</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Hidden Audio Element */}
        <audio ref={jamendo.audioRef} className="hidden" />
      </CardContent>
    </Card>
  );
}

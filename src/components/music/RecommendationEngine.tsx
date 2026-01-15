import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useJamendo, JamendoTrack } from "@/hooks/useJamendo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Sparkles, Play, Pause, Music2, Zap, Target, RefreshCw,
  Moon, Dumbbell, BookOpen, Coffee, Car, Heart, Brain,
  TrendingUp, ChevronRight, Plus, ListMusic
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
}

const activityIcons: Record<string, React.ReactNode> = {
  sleep: <Moon className="w-4 h-4" />,
  workout: <Dumbbell className="w-4 h-4" />,
  study: <BookOpen className="w-4 h-4" />,
  relax: <Coffee className="w-4 h-4" />,
  commute: <Car className="w-4 h-4" />,
  meditation: <Brain className="w-4 h-4" />,
};

export function RecommendationEngine() {
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedTrack[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [queue, setQueue] = useState<RecommendedTrack[]>([]);
  
  const jamendo = useJamendo();

  // Calculate activity profiles from historical data
  const loadActivityProfiles = useCallback(async () => {
    setIsLoadingProfiles(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch sessions with songs and biometrics
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

      // Group by activity and calculate optimal characteristics
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

        // Calculate flow score from biometrics
        const sessionBiometrics = biometrics?.filter(b => b.session_id === session.id) || [];
        if (sessionBiometrics.length > 0) {
          const avgFocus = sessionBiometrics.reduce((sum, b) => sum + (b.focus_score || 0), 0) / sessionBiometrics.length;
          const avgRelax = sessionBiometrics.reduce((sum, b) => sum + (b.relaxation_score || 0), 0) / sessionBiometrics.length;
          const flowScore = (avgFocus + avgRelax) / 2;
          
          // Add songs with their flow scores
          session.session_songs?.forEach((ss: any) => {
            if (ss.songs) {
              entry.songs.push({ ...ss.songs, flowScore });
              entry.flowScores.push(flowScore);
            }
          });
        }
      });

      // Calculate profiles for each activity
      const calculatedProfiles: ActivityProfile[] = [];
      
      activityMap.forEach((data, activityId) => {
        if (data.songs.length === 0) return;

        const songs = data.songs;
        const avgFlowScore = data.flowScores.length > 0 
          ? data.flowScores.reduce((a, b) => a + b, 0) / data.flowScores.length 
          : 50;

        // Weighted average by flow score
        const totalWeight = songs.reduce((sum, s) => sum + (s.flowScore || 50), 0);
        
        const optimalTempo = songs.reduce((sum, s) => sum + (s.tempo || 100) * (s.flowScore || 50), 0) / totalWeight;
        const optimalEnergy = songs.reduce((sum, s) => sum + (s.energy || 0.5) * (s.flowScore || 50), 0) / totalWeight;
        const optimalValence = songs.reduce((sum, s) => sum + (s.valence || 0.5) * (s.flowScore || 50), 0) / totalWeight;
        const optimalDanceability = songs.reduce((sum, s) => sum + (s.danceability || 0.5) * (s.flowScore || 50), 0) / totalWeight;

        // Calculate ranges
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
      
      // Auto-select first activity
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

  // Generate recommendations based on selected activity
  const generateRecommendations = useCallback(async () => {
    const profile = profiles.find(p => p.activityId === selectedActivity);
    if (!profile) return;

    setIsLoadingRecommendations(true);

    try {
      const { tempo, energy } = profile.characteristics;
      
      // Search for tracks matching optimal characteristics
      const tracks = await jamendo.searchByTempoEnergy(
        tempo.optimal,
        energy.optimal,
        profile.activityName
      );

      // Score each track based on how well it matches
      const scoredTracks: RecommendedTrack[] = tracks.map(track => {
        const matchReasons: string[] = [];
        let matchScore = 0;

        // Tempo matching (we estimate based on speed parameter mapping)
        const estimatedTempo = track.duration < 180 ? 130 : track.duration < 240 ? 110 : 90;
        const tempoMatch = 100 - Math.abs(estimatedTempo - tempo.optimal);
        if (tempoMatch > 80) {
          matchScore += 25;
          matchReasons.push("Tempo matches your flow zone");
        }

        // Energy matching (based on acoustic/electric preference)
        if (energy.optimal > 0.5) {
          matchScore += 25;
          matchReasons.push("High energy for optimal focus");
        } else {
          matchScore += 20;
          matchReasons.push("Calm energy for relaxation");
        }

        // Activity-specific bonuses
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

        // Popularity bonus
        matchScore += 10;

        return {
          ...track,
          matchScore: Math.min(matchScore, 100),
          matchReasons,
        };
      });

      // Sort by match score
      scoredTracks.sort((a, b) => b.matchScore - a.matchScore);
      
      setRecommendations(scoredTracks);
      toast.success(`Found ${scoredTracks.length} recommendations for ${profile.activityName}`);
    } catch (error) {
      console.error("Error generating recommendations:", error);
      toast.error("Failed to generate recommendations");
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [profiles, selectedActivity, jamendo]);

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

  const selectedProfile = profiles.find(p => p.activityId === selectedActivity);

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Smart Recommendations
            </CardTitle>
            <CardDescription>
              AI-powered music suggestions optimized for your flow state
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={generateRecommendations}
            disabled={isLoadingRecommendations}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoadingRecommendations && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
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
                <Target className="w-4 h-4 text-primary" />
                Optimal Settings for {selectedProfile.activityName}
              </h4>
              <Badge variant="outline" className="text-xs">
                Avg Flow: {Math.round(selectedProfile.avgFlowScore)}%
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tempo</span>
                  <span className="font-medium">{selectedProfile.characteristics.tempo.optimal} BPM</span>
                </div>
                <Progress 
                  value={(selectedProfile.characteristics.tempo.optimal - 60) / 1.2} 
                  className="h-2"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Energy</span>
                  <span className="font-medium">{Math.round(selectedProfile.characteristics.energy.optimal * 100)}%</span>
                </div>
                <Progress 
                  value={selectedProfile.characteristics.energy.optimal * 100} 
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
                      className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
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

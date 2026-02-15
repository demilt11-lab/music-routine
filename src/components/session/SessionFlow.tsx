import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Play, Square, Music, Activity, Clock, Heart, Brain,
  ChevronRight, Check, Smile, Meh, Frown, Loader2,
  Moon, Dumbbell, BookOpen, Coffee, Car, Sparkles, Volume2, BarChart3
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useBiometricTracking } from "@/hooks/useBiometricTracking";
import { useAutoPlayQueue } from "@/hooks/useAutoPlayQueue";
import { useJamendo, JamendoTrack } from "@/hooks/useJamendo";
import { useAdaptiveMusic } from "@/hooks/useAdaptiveMusic";
import { useFlowNotifications } from "@/hooks/useFlowNotifications";
import { useSpotifyAutoQueue } from "@/hooks/useSpotifyAutoQueue";
import { useTrackFeedback } from "@/hooks/useTrackFeedback";
import { DeviceConnector } from "./DeviceConnector";
import { EEGConnector } from "./EEGConnector";
import { AdaptiveMusicPanel } from "./AdaptiveMusicPanel";
import { SessionSummaryReport } from "./SessionSummaryReport";
import { PredictiveQueueBuilder } from "./PredictiveQueueBuilder";
import { ActivityStartingRecommendation } from "./ActivityStartingRecommendation";
import { LiveAdaptationFeed, type AdaptationEvent } from "./LiveAdaptationFeed";
import { useActivityStartingSong } from "@/hooks/useActivityStartingSong";
import { MusicPlayer } from "@/components/music/MusicPlayer";
import { EEGReading } from "@/hooks/useMuseEEG";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ActivityType {
  id: string;
  name: string;
  description: string;
  icon: string;
}

type SessionStep = "select-activity" | "connect-device" | "active" | "rate-mood" | "complete";
type MoodRating = "great" | "good" | "neutral" | "bad" | "terrible";

const activityIcons: Record<string, React.ReactNode> = {
  sleep: <Moon className="w-6 h-6" />,
  workout: <Dumbbell className="w-6 h-6" />,
  study: <BookOpen className="w-6 h-6" />,
  relax: <Coffee className="w-6 h-6" />,
  commute: <Car className="w-6 h-6" />,
};

const moodOptions: { value: MoodRating; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "great", label: "Great", icon: <Smile className="w-8 h-8" />, color: "text-green-500 bg-green-500/20 border-green-500" },
  { value: "good", label: "Good", icon: <Smile className="w-8 h-8" />, color: "text-emerald-500 bg-emerald-500/20 border-emerald-500" },
  { value: "neutral", label: "Neutral", icon: <Meh className="w-8 h-8" />, color: "text-yellow-500 bg-yellow-500/20 border-yellow-500" },
  { value: "bad", label: "Not Great", icon: <Frown className="w-8 h-8" />, color: "text-orange-500 bg-orange-500/20 border-orange-500" },
  { value: "terrible", label: "Terrible", icon: <Frown className="w-8 h-8" />, color: "text-red-500 bg-red-500/20 border-red-500" },
];

export function SessionFlow() {
  const [step, setStep] = useState<SessionStep>("select-activity");
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [moodBefore, setMoodBefore] = useState<MoodRating | null>(null);
  const [moodAfter, setMoodAfter] = useState<MoodRating | null>(null);
  const [notes, setNotes] = useState("");
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const [isEEGConnected, setIsEEGConnected] = useState(false);
  const [eegMetrics, setEEGMetrics] = useState<{ focus: number; relaxation: number; meditation: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSummaryReport, setShowSummaryReport] = useState(false);

  // Session tracking for summary report
  const [biometricHistory, setBiometricHistory] = useState<Array<{
    timestamp: Date;
    heartRate: number;
    focusScore: number;
    relaxationScore: number;
    stressLevel: number;
  }>>([]);
  const [musicAdaptations, setMusicAdaptations] = useState<Array<{
    timestamp: Date;
    trackName: string;
    artist: string;
    tempo: number;
    energy: number;
    reason: string;
    triggerType: 'biometric' | 'goal' | 'manual' | 'auto';
  }>>([]);

  const { state: biometricState, startTracking, stopTracking, addReading, saveReadingsToSession } = useBiometricTracking();
  
  // Starting song recommendation based on previous session data
  const { recommendation: startingRecommendation, isLoading: isLoadingStarting, fetchStartingSong } = useActivityStartingSong();
  
  // Auto-play queue management
  const autoPlayQueue = useAutoPlayQueue();
  
  // Jamendo music player for actual playback
  const jamendo = useJamendo();
  
  // Adaptive music recommendations
  const adaptiveMusic = useAdaptiveMusic(selectedActivity?.name || "study");
  
  // Spotify auto-queue for adaptive recommendations
  const spotifyAutoQueue = useSpotifyAutoQueue();
  
  // Track feedback (thumbs up/down)
  const trackFeedback = useTrackFeedback(selectedActivity?.name);
  
  // Flow notifications for session milestones
  const flowNotifications = useFlowNotifications({
    audioEnabled: true,
    hapticEnabled: true,
    toastEnabled: true,
  });
  
  // Live adaptation feed events
  const [adaptationEvents, setAdaptationEvents] = useState<AdaptationEvent[]>([]);
  
  // Session milestone tracking
  const sessionMilestoneRef = useRef<number>(0);
  
  // Track last processed recommendation to avoid duplicate queue additions
  const lastRecommendationRef = useRef<string | null>(null);
  
  // Helper to add adaptation events
  const addAdaptationEvent = useCallback((event: Omit<AdaptationEvent, "id" | "timestamp">) => {
    setAdaptationEvents(prev => [{
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date(),
    }, ...prev].slice(0, 100));
  }, []);

  // Fetch activity types
  useEffect(() => {
    const fetchActivities = async () => {
      const { data } = await supabase.from("activity_types").select("*");
      if (data) setActivityTypes(data);
    };
    fetchActivities();
  }, []);

  // Timer for active session with milestone notifications
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === "active" && startTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
        setElapsedTime(elapsed);
        
        // Check for session time milestones (every 15 minutes)
        const currentMilestone = Math.floor(elapsed / 900); // 900 seconds = 15 minutes
        if (currentMilestone > sessionMilestoneRef.current && currentMilestone > 0) {
          sessionMilestoneRef.current = currentMilestone;
          const minutes = currentMilestone * 15;
          flowNotifications.notifySessionMilestone(
            `${minutes} Minutes Complete!`,
            `Great job staying focused for ${minutes} minutes${selectedActivity ? ` on ${selectedActivity.name}` : ""}`
          );
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, startTime, selectedActivity, flowNotifications]);

  // Auto-play: Handle track ending and queue next song
  useEffect(() => {
    if (!autoPlayQueue.state.isEnabled) return;

    jamendo.setOnTrackEnd(() => {
      const nextTrack = autoPlayQueue.onTrackEnded();
      if (nextTrack && nextTrack.audioUrl) {
        // Find the Jamendo track with this URL and play it
        const jamendoTrack = jamendo.tracks.find(t => t.audio === nextTrack.audioUrl);
        if (jamendoTrack) {
          jamendo.play(jamendoTrack);
        }
      }
    });

    return () => {
      jamendo.setOnTrackEnd(null);
    };
  }, [autoPlayQueue.state.isEnabled, autoPlayQueue, jamendo]);

  // Auto-play: When recommendations come in, search Spotify first, then Jamendo fallback
  useEffect(() => {
    const recommendation = adaptiveMusic.state.currentRecommendation;
    if (!autoPlayQueue.state.isEnabled || !recommendation) return;

    // Avoid processing the same recommendation twice
    const recommendationKey = `${recommendation.targetTempo}-${recommendation.targetEnergy}`;
    if (lastRecommendationRef.current === recommendationKey) return;
    lastRecommendationRef.current = recommendationKey;

    // Log the recommendation as an adaptation event
    addAdaptationEvent({
      type: "recommendation",
      title: "AI Recommendation",
      description: recommendation.reasoning,
      details: {
        action: recommendation.action,
        targetTempo: recommendation.targetTempo,
        targetEnergy: recommendation.targetEnergy,
      },
    });

    const fetchAndQueueTracks = async () => {
      // Try Spotify first if connected
      if (spotifyAutoQueue.isSpotifyConnected()) {
        const spotifyTracks = await spotifyAutoQueue.searchByRecommendation(
          recommendation.targetTempo,
          recommendation.targetEnergy,
          selectedActivity?.name
        );

        if (spotifyTracks.length > 0) {
          const queuedTracks = spotifyTracks.slice(0, 5).map((track) => ({
            id: track.id,
            title: track.name,
            artist: track.artist,
            tempo: recommendation.targetTempo,
            energy: recommendation.targetEnergy,
            audioUrl: track.preview_url || undefined,
            source: "spotify" as const,
            reason: recommendation.reasoning,
          }));

          autoPlayQueue.addToQueue(queuedTracks);

          addAdaptationEvent({
            type: "spotify_queue",
            title: `Queued ${queuedTracks.length} Spotify tracks`,
            description: `"${spotifyTracks[0].name}" by ${spotifyTracks[0].artist} + ${queuedTracks.length - 1} more`,
            details: {
              source: "Spotify",
              targetTempo: recommendation.targetTempo,
              targetEnergy: recommendation.targetEnergy,
              trackTitle: spotifyTracks[0].name,
              trackArtist: spotifyTracks[0].artist,
            },
          });

          // Dispatch event so MusicTabs/SpotifyPlayer can play the track
          if (queuedTracks.length > 0) {
            window.dispatchEvent(new CustomEvent("adaptive-spotify-play", {
              detail: { uri: spotifyTracks[0].uri, name: spotifyTracks[0].name, artist: spotifyTracks[0].artist },
            }));
            toast.success(`Spotify auto-play: "${spotifyTracks[0].name}" based on your biometrics`);
          }
          return; // Don't fall through to Jamendo
        }
      }

      // Fallback to Jamendo
      const tracks = await jamendo.searchByTempoEnergy(
        recommendation.targetTempo,
        recommendation.targetEnergy,
        selectedActivity?.name
      );

      if (tracks.length > 0) {
        const queuedTracks = tracks.slice(0, 5).map((track: JamendoTrack) => ({
          id: track.id,
          title: track.name,
          artist: track.artist_name,
          tempo: recommendation.targetTempo,
          energy: recommendation.targetEnergy,
          audioUrl: track.audio,
          source: "jamendo" as const,
          reason: recommendation.reasoning,
        }));

        autoPlayQueue.addToQueue(queuedTracks);

        addAdaptationEvent({
          type: "track_change",
          title: `Queued ${queuedTracks.length} Jamendo tracks`,
          description: `"${tracks[0].name}" by ${tracks[0].artist_name} + ${queuedTracks.length - 1} more`,
          details: {
            source: "Jamendo",
            targetTempo: recommendation.targetTempo,
            targetEnergy: recommendation.targetEnergy,
            trackTitle: tracks[0].name,
            trackArtist: tracks[0].artist_name,
          },
        });

        // If nothing is playing, start the first track
        if (!jamendo.currentTrack && queuedTracks.length > 0) {
          const firstTrack = tracks[0];
          jamendo.play(firstTrack);
          autoPlayQueue.skipToNext();
          toast.success(`Auto-playing: "${firstTrack.name}" based on your biometrics`);
        }
      }
    };

    fetchAndQueueTracks();
  }, [adaptiveMusic.state.currentRecommendation, autoPlayQueue.state.isEnabled, selectedActivity?.name, addAdaptationEvent, spotifyAutoQueue]);

  // Update adaptive music with biometric data (including EEG)
  useEffect(() => {
    if (biometricState.isTracking && biometricState.currentReading) {
      const currentReading = biometricState.currentReading;
      
      // If EEG is connected, use EEG-derived focus and relaxation scores
      const focusScore = eegMetrics?.focus ?? currentReading.focusScore ?? 50;
      const relaxationScore = eegMetrics?.relaxation ?? currentReading.relaxationScore ?? 50;
      
      adaptiveMusic.updateBiometrics({
        heartRate: currentReading.heartRate || 70,
        stressLevel: currentReading.stressLevel || 30,
        focusScore,
        relaxationScore,
        flowState: biometricState.flowState,
        // Include EEG data if available
        eegAlpha: currentReading.eegAlpha,
        eegBeta: currentReading.eegBeta,
        eegTheta: currentReading.eegTheta,
        eegGamma: currentReading.eegGamma,
        eegDelta: currentReading.eegDelta,
        meditationScore: eegMetrics?.meditation,
      });
    }
  }, [biometricState.currentReading, biometricState.flowState, biometricState.isTracking, adaptiveMusic, eegMetrics]);

  // Sync user preferences into adaptive music engine
  useEffect(() => {
    if (trackFeedback.summary) {
      adaptiveMusic.setUserPreferences(trackFeedback.summary);
    }
  }, [trackFeedback.summary, adaptiveMusic]);

  // Update current song info for adaptive music (Jamendo)
  useEffect(() => {
    if (jamendo.currentTrack) {
      adaptiveMusic.setCurrentSong({
        title: jamendo.currentTrack.name,
        artist: jamendo.currentTrack.artist_name,
      });
    }
  }, [jamendo.currentTrack, adaptiveMusic]);

  // Listen for Spotify track plays from MusicTabs and feed into adaptive engine
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || step !== "active") return;

      // Update the adaptive music engine with the Spotify track
      adaptiveMusic.setCurrentSong({
        title: detail.title,
        artist: detail.artist,
      });

      // Trigger an immediate recommendation based on current biometrics
      if (biometricState.isTracking) {
        adaptiveMusic.getImmediateRecommendation();
      }

      // Track as a music adaptation for session summary
      setMusicAdaptations(prev => [...prev, {
        timestamp: new Date(),
        trackName: detail.title,
        artist: detail.artist,
        tempo: adaptiveMusic.state.currentRecommendation?.targetTempo || 0,
        energy: adaptiveMusic.state.currentRecommendation?.targetEnergy || 0,
        reason: "User played Spotify track — adaptive curation triggered",
        triggerType: 'manual' as const,
      }]);
    };

    window.addEventListener("spotify-track-play", handler);
    return () => window.removeEventListener("spotify-track-play", handler);
  }, [step, biometricState.isTracking, adaptiveMusic]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleActivitySelect = (activity: ActivityType) => {
    setSelectedActivity(activity);
    fetchStartingSong(activity.id);
  };

  const handleMoodBeforeSelect = (mood: MoodRating) => {
    setMoodBefore(mood);
  };

  const handleStartSession = async () => {
    if (!selectedActivity || !moodBefore) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to start a session");
      return;
    }

    // Create session in database
    const { data: session, error } = await supabase
      .from("listening_sessions")
      .insert({
        user_id: user.id,
        activity_type_id: selectedActivity.id,
        name: `${selectedActivity.name} Session`,
        mood_before: moodBefore,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to start session");
      return;
    }

    setSessionId(session.id);
    setStartTime(new Date());
    startTracking(session.id);
    setStep("active");
    toast.success("Session started! Play some music and we'll track your biometrics.");
  };

  const handleHeartRateUpdate = useCallback((heartRate: number) => {
    // Calculate other metrics based on heart rate
    const baseStress = Math.max(0, Math.min(100, (heartRate - 60) * 1.5 + Math.random() * 10));
    const relaxation = Math.max(0, Math.min(100, 100 - baseStress + Math.random() * 10));
    const focus = Math.max(0, Math.min(100, 50 + (80 - heartRate) * 0.5 + Math.random() * 15));

    const reading = {
      heartRate,
      heartRateVariability: Math.round(50 - (heartRate - 70) * 0.3 + Math.random() * 10),
      stressLevel: Math.round(baseStress),
      relaxationScore: Math.round(relaxation),
      focusScore: Math.round(focus),
      deviceType: "bluetooth_hr",
      recordedAt: new Date(),
    };

    addReading(reading);

    // Track for session summary
    setBiometricHistory(prev => [...prev, {
      timestamp: new Date(),
      heartRate,
      focusScore: Math.round(focus),
      relaxationScore: Math.round(relaxation),
      stressLevel: Math.round(baseStress),
    }]);
  }, [addReading]);

  const handleEEGUpdate = useCallback((reading: EEGReading, metrics: { focus: number; relaxation: number; meditation: number }) => {
    setEEGMetrics(metrics);
    
    // Update biometric reading with EEG data
    addReading({
      eegAlpha: reading.alpha,
      eegBeta: reading.beta,
      eegTheta: reading.theta,
      eegGamma: reading.gamma,
      eegDelta: reading.delta,
      focusScore: metrics.focus,
      relaxationScore: metrics.relaxation,
      deviceType: "muse_eeg",
      recordedAt: new Date(),
    });

    // Track for session summary
    setBiometricHistory(prev => [...prev, {
      timestamp: new Date(),
      heartRate: biometricState.currentReading?.heartRate || 70,
      focusScore: metrics.focus,
      relaxationScore: metrics.relaxation,
      stressLevel: biometricState.currentReading?.stressLevel || 30,
    }]);
  }, [addReading, biometricState.currentReading]);

  // Track music adaptations when recommendations change + add to live feed
  useEffect(() => {
    const recommendation = adaptiveMusic.state.currentRecommendation;
    if (recommendation && jamendo.currentTrack && step === "active") {
      setMusicAdaptations(prev => [...prev, {
        timestamp: new Date(),
        trackName: jamendo.currentTrack?.name || "Unknown",
        artist: jamendo.currentTrack?.artist_name || "Unknown",
        tempo: recommendation.targetTempo,
        energy: recommendation.targetEnergy,
        reason: recommendation.reasoning,
        triggerType: 'biometric' as const,
      }]);
    }
  }, [adaptiveMusic.state.currentRecommendation?.reasoning]);

  // Track flow state changes in live feed
  useEffect(() => {
    if (step === "active" && biometricState.flowState !== "none") {
      addAdaptationEvent({
        type: "flow_shift",
        title: `Flow State: ${biometricState.flowState}`,
        description: biometricState.flowState === "in-flow"
          ? "You've entered flow state! Music is optimized to maintain it."
          : biometricState.flowState === "entering"
          ? "Approaching flow state — music adapting to guide you in."
          : "Flow state fading — adjusting music to re-engage focus.",
        details: { flowState: biometricState.flowState },
      });
    }
  }, [biometricState.flowState, step, addAdaptationEvent]);

  const handleEndSession = () => {
    stopTracking();
    setShowSummaryReport(true);
    setStep("rate-mood");
  };

  const handleMoodAfterSelect = (mood: MoodRating) => {
    setMoodAfter(mood);
  };

  const handleSaveSession = async () => {
    if (!sessionId || !moodAfter) return;

    setIsSaving(true);

    try {
      // Update session with end time and mood
      const { error: updateError } = await supabase
        .from("listening_sessions")
        .update({
          ended_at: new Date().toISOString(),
          mood_after: moodAfter,
          notes: notes || null,
        })
        .eq("id", sessionId);

      if (updateError) throw updateError;

      // Save biometric readings
      if (biometricState.readings.length > 0) {
        await saveReadingsToSession(sessionId);
      }

      setStep("complete");
      toast.success("Session saved successfully!");
    } catch (error) {
      console.error("Error saving session:", error);
      toast.error("Failed to save session");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewSession = () => {
    setStep("select-activity");
    setSelectedActivity(null);
    setSessionId(null);
    setStartTime(null);
    setElapsedTime(0);
    setMoodBefore(null);
    setMoodAfter(null);
    setNotes("");
    setBiometricHistory([]);
    setMusicAdaptations([]);
    setAdaptationEvents([]);
    setShowSummaryReport(false);
  };

  const flowStateColors = {
    "none": "bg-muted",
    "entering": "bg-yellow-500",
    "in-flow": "bg-green-500",
    "exiting": "bg-orange-500",
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Listening Session
        </CardTitle>
        <CardDescription>
          Track your biometrics while listening to discover your optimal music
        </CardDescription>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mt-4">
          {["select-activity", "connect-device", "active", "rate-mood", "complete"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                step === s
                  ? "bg-primary text-primary-foreground"
                  : ["select-activity", "connect-device", "active", "rate-mood", "complete"].indexOf(step) > i
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              )}>
                {["select-activity", "connect-device", "active", "rate-mood", "complete"].indexOf(step) > i ? (
                  <Check className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 4 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* Step 1: Select Activity */}
        {step === "select-activity" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-3">What are you doing?</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {activityTypes.map((activity) => (
                  <button
                    key={activity.id}
                    onClick={() => handleActivitySelect(activity)}
                    className={cn(
                      "p-4 rounded-lg border-2 transition-all text-center",
                      selectedActivity?.id === activity.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                      {activityIcons[activity.name] || <Music className="w-6 h-6" />}
                    </div>
                    <p className="font-medium capitalize">{activity.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {selectedActivity && (
              <div>
                <h3 className="font-medium mb-3">How are you feeling right now?</h3>
                <div className="flex flex-wrap gap-3">
                  {moodOptions.map((mood) => (
                    <button
                      key={mood.value}
                      onClick={() => handleMoodBeforeSelect(mood.value)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all min-w-[80px]",
                        moodBefore === mood.value
                          ? mood.color
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {mood.icon}
                      <span className="text-sm font-medium">{mood.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Starting Song Recommendation */}
            {selectedActivity && startingRecommendation && (
              <ActivityStartingRecommendation
                recommendation={startingRecommendation}
                isLoading={isLoadingStarting}
                activityName={selectedActivity.name}
              />
            )}
            {selectedActivity && isLoadingStarting && !startingRecommendation && (
              <ActivityStartingRecommendation
                recommendation={{ optimalTempo: 0, optimalEnergy: 0, topSongs: [], lastSessionSummary: null, hasHistory: false }}
                isLoading={true}
                activityName={selectedActivity.name}
              />
            )}

            <Button
              onClick={() => setStep("connect-device")}
              disabled={!selectedActivity || !moodBefore}
              className="w-full"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Connect Device */}
        {step === "connect-device" && (
          <div className="space-y-6">
            <Tabs defaultValue="heart-rate" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="heart-rate" className="flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Heart Rate
                </TabsTrigger>
                <TabsTrigger value="eeg" className="flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  EEG Headband
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="heart-rate" className="mt-4">
                <DeviceConnector
                  onHeartRateUpdate={handleHeartRateUpdate}
                  onConnectionChange={setIsDeviceConnected}
                />
              </TabsContent>
              
              <TabsContent value="eeg" className="mt-4">
                <EEGConnector
                  onEEGUpdate={handleEEGUpdate}
                  onConnectionChange={setIsEEGConnected}
                />
              </TabsContent>
            </Tabs>

            {/* Connection Status Summary */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Heart className={cn("w-4 h-4", isDeviceConnected ? "text-green-500" : "text-muted-foreground")} />
                <span className="text-sm">{isDeviceConnected ? "HR Connected" : "HR Not Connected"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Brain className={cn("w-4 h-4", isEEGConnected ? "text-purple-500" : "text-muted-foreground")} />
                <span className="text-sm">{isEEGConnected ? "EEG Connected" : "EEG Not Connected"}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("select-activity")}>
                Back
              </Button>
              <Button onClick={handleStartSession} className="flex-1">
                {isDeviceConnected || isEEGConnected ? (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Session
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Start with Simulated Data
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Active Session */}
        {step === "active" && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Badge className="bg-primary/20 text-primary capitalize">
                  {selectedActivity?.name}
                </Badge>
                <Badge className={cn(flowStateColors[biometricState.flowState], "text-white")}>
                  {biometricState.flowState === "in-flow" ? "🎯 In Flow!" : biometricState.flowState}
                </Badge>
              </div>
              <div className="text-5xl font-bold tabular-nums mb-2">
                {formatTime(elapsedTime)}
              </div>
              <p className="text-muted-foreground">Session in progress</p>
            </div>

            {/* Live Biometrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <Heart className="w-5 h-5 mx-auto mb-1 text-red-500 animate-pulse" />
                <div className="text-2xl font-bold">
                  {biometricState.currentReading?.heartRate || "--"}
                </div>
                <div className="text-xs text-muted-foreground">Heart Rate</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <Activity className="w-5 h-5 mx-auto mb-1 text-orange-500" />
                <div className="text-2xl font-bold">
                  {biometricState.currentReading?.stressLevel ?? "--"}%
                </div>
                <div className="text-xs text-muted-foreground">Stress</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <Sparkles className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                <div className="text-2xl font-bold">
                  {biometricState.currentReading?.focusScore ?? "--"}%
                </div>
                <div className="text-xs text-muted-foreground">Focus</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <Clock className="w-5 h-5 mx-auto mb-1 text-green-500" />
                <div className="text-2xl font-bold">
                  {biometricState.readings.length}
                </div>
                <div className="text-xs text-muted-foreground">Readings</div>
              </div>
            </div>

            {/* Flow State Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Flow State Progress</span>
                <span className="capitalize">{biometricState.flowState}</span>
              </div>
              <Progress 
                value={
                  biometricState.flowState === "in-flow" ? 100 :
                  biometricState.flowState === "entering" ? 66 :
                  biometricState.flowState === "exiting" ? 33 : 0
                } 
                className="h-3"
              />
            </div>

            {/* Now Playing - Integrated Music Player */}
            {jamendo.currentTrack && (
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-3">
                  <Volume2 className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Now Playing</span>
                  {autoPlayQueue.state.isEnabled && (
                    <Badge variant="secondary" className="text-xs">Auto-Play</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {jamendo.currentTrack.image && (
                    <img 
                      src={jamendo.currentTrack.image} 
                      alt={jamendo.currentTrack.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{jamendo.currentTrack.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {jamendo.currentTrack.artist_name}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={jamendo.togglePlay}
                  >
                    {jamendo.isPlaying ? (
                      <Square className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Adaptive Music Recommendations with Auto-Play */}
            {selectedActivity && (
              <AdaptiveMusicPanel
                activityType={selectedActivity.name}
                biometricState={{
                  heartRate: biometricState.currentReading?.heartRate || 70,
                  stressLevel: biometricState.currentReading?.stressLevel || 30,
                  focusScore: biometricState.currentReading?.focusScore || 50,
                  relaxationScore: biometricState.currentReading?.relaxationScore || 50,
                  flowState: biometricState.flowState,
                }}
                isTracking={biometricState.isTracking}
                autoPlayEnabled={autoPlayQueue.state.isEnabled}
                onAutoPlayToggle={(enabled) => {
                  if (enabled) {
                    autoPlayQueue.enableAutoPlay();
                    // Load initial tracks for the activity
                    jamendo.loadByMood(selectedActivity.name);
                  } else {
                    autoPlayQueue.disableAutoPlay();
                  }
                }}
                queue={autoPlayQueue.state.queue}
                currentQueueTrack={autoPlayQueue.getCurrentTrack()}
                onSkipNext={() => {
                  const nextTrack = autoPlayQueue.skipToNext();
                  if (nextTrack && nextTrack.audioUrl) {
                    const jamendoTrack = jamendo.tracks.find(t => t.audio === nextTrack.audioUrl);
                    if (jamendoTrack) {
                      jamendo.play(jamendoTrack);
                    }
                  }
                }}
                onSongRecommended={(song) => {
                  toast.success(`Recommended: "${song.title}" by ${song.artist}`);
                  // If auto-play is enabled, the track will be queued automatically
                  if (!autoPlayQueue.state.isEnabled) {
                    // Manual mode: just notify
                    toast.info("Enable Auto-Play to automatically queue recommended songs");
                  }
                }}
              />
            )}

            {/* Live Adaptation Feed */}
            {step === "active" && (
              <LiveAdaptationFeed
                events={adaptationEvents}
                getFeedback={trackFeedback.getFeedback}
                onFeedback={(trackTitle, trackArtist, feedback, event) => {
                  trackFeedback.submitFeedback({
                    trackTitle,
                    trackArtist,
                    feedback,
                    activityType: selectedActivity?.name,
                    targetTempo: event.details?.targetTempo,
                    targetEnergy: event.details?.targetEnergy,
                  });
                }}
              />
            )}

            {/* Predictive Queue Builder */}
            {selectedActivity && biometricState.isTracking && (
              <PredictiveQueueBuilder
                activityType={selectedActivity.name}
                currentBiometrics={{
                  focus: biometricState.currentReading?.focusScore || 50,
                  relaxation: biometricState.currentReading?.relaxationScore || 50,
                  stress: biometricState.currentReading?.stressLevel || 30,
                  heartRate: biometricState.currentReading?.heartRate || 70,
                }}
                goalFlowScore={70}
                isSessionActive={step === "active"}
                onQueueReady={(tracks) => {
                  tracks.forEach(track => {
                    autoPlayQueue.addToQueue([track]);
                  });
                }}
              />
            )}

            {/* Hidden audio element for Jamendo playback */}
            <audio ref={jamendo.audioRef} className="hidden" />

            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Music className="w-4 h-4" />
                Play music to influence your biometrics
              </span>
            </div>

            <Button
              variant="destructive"
              onClick={handleEndSession}
              className="w-full"
              size="lg"
            >
              <Square className="w-4 h-4 mr-2" />
              End Session
            </Button>
          </div>
        )}

        {/* Step 4: Rate Mood After */}
        {step === "rate-mood" && (
          <div className="space-y-6">
            {/* Session Summary Report Dialog */}
            {showSummaryReport && biometricHistory.length > 0 && (
              <Dialog open={showSummaryReport} onOpenChange={setShowSummaryReport}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <SessionSummaryReport
                    sessionDuration={elapsedTime}
                    activityName={selectedActivity?.name || "Session"}
                    moodBefore={moodBefore || "neutral"}
                    moodAfter={moodAfter || "neutral"}
                    biometricHistory={biometricHistory}
                    musicAdaptations={musicAdaptations}
                    onClose={() => setShowSummaryReport(false)}
                  />
                </DialogContent>
              </Dialog>
            )}

            <div className="text-center">
              <h3 className="text-xl font-bold mb-2">Session Complete!</h3>
              <p className="text-muted-foreground">
                {formatTime(elapsedTime)} • {biometricState.readings.length} readings
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setShowSummaryReport(true)}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View Summary Report
              </Button>
            </div>

            <div>
              <h3 className="font-medium mb-3">How do you feel now?</h3>
              <div className="flex flex-wrap gap-3 justify-center">
                {moodOptions.map((mood) => (
                  <button
                    key={mood.value}
                    onClick={() => handleMoodAfterSelect(mood.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all min-w-[80px]",
                      moodAfter === mood.value
                        ? mood.color
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {mood.icon}
                    <span className="text-sm font-medium">{mood.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Any notes about this session?</h3>
              <Textarea
                placeholder="What worked well? Any observations about the music or your focus?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              onClick={handleSaveSession}
              disabled={!moodAfter || isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save Session
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === "complete" && (
          <div className="text-center py-8 space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Session Saved!</h3>
              <p className="text-muted-foreground">
                Your biometric data and mood ratings have been recorded.
                Check your insights to see how this session compared.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{formatTime(elapsedTime)}</div>
                <div className="text-sm text-muted-foreground">Duration</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{biometricState.averages.focusScore}%</div>
                <div className="text-sm text-muted-foreground">Avg Focus</div>
              </div>
            </div>

            <Button onClick={handleNewSession} className="w-full max-w-md">
              Start New Session
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

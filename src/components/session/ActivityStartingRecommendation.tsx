import { memo, useMemo } from "react";
import {
  Activity,
  Clock,
  Heart,
  Music,
  Play,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdaptiveMusicPanel } from "./AdaptiveMusicPanel";
import { LiveAdaptationFeed, type AdaptationEvent } from "./LiveAdaptationFeed";
import { PredictiveQueueBuilder } from "./PredictiveQueueBuilder";
import { BiometricMusicMapper } from "./BiometricMusicMapper";

interface ActiveSessionPanelProps {
  selectedActivityName?: string;
  elapsedTime: number;
  flowState: "none" | "entering" | "in-flow" | "exiting";
  currentReading?: {
    heartRate?: number | null;
    stressLevel?: number | null;
    focusScore?: number | null;
    relaxationScore?: number | null;
  } | null;
  readingCount: number;
  jamendo: {
    currentTrack: {
      name: string;
      artist_name: string;
      image?: string;
    } | null;
    isPlaying: boolean;
    togglePlay: () => Promise<void> | void;
    play: (track: any) => Promise<void> | void;
    loadByMood: (mood: string) => Promise<void> | void;
    tracks: Array<{ audio: string } & any>;
    audioRef: React.RefObject<HTMLAudioElement>;
  };
  adaptiveMusicState: {
    isEnabled: boolean;
    currentRecommendation?: {
      targetTempo?: number;
      targetEnergy?: number;
      action?: string;
      reasoning?: string;
    } | null;
  };
  autoPlayQueue: {
    state: {
      isEnabled: boolean;
      queue: any[];
    };
    enableAutoPlay: () => void;
    disableAutoPlay: () => void;
    skipToNext: () => any;
    getCurrentTrack: () => any;
    addToQueue: (tracks: any[]) => void;
  };
  adaptationEvents: AdaptationEvent[];
  trackFeedback: {
    getFeedback: (trackTitle: string, trackArtist: string) => any;
    submitFeedback: (payload: {
      trackTitle: string;
      trackArtist: string;
      feedback: "up" | "down";
      activityType?: string;
      targetTempo?: number;
      targetEnergy?: number;
    }) => void;
  };
  onEndSession: () => void;
  onResetRecommendationDedup: () => void;
}

const flowStateColors = {
  none: "bg-muted",
  entering: "bg-yellow-500",
  "in-flow": "bg-green-500",
  exiting: "bg-orange-500",
} as const;

function formatTime(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const ActiveSessionPanel = memo(function ActiveSessionPanel({
  selectedActivityName,
  elapsedTime,
  flowState,
  currentReading,
  readingCount,
  jamendo,
  adaptiveMusicState,
  autoPlayQueue,
  adaptationEvents,
  trackFeedback,
  onEndSession,
  onResetRecommendationDedup,
}: ActiveSessionPanelProps) {
  const flowProgress = useMemo(() => {
    if (flowState === "in-flow") return 100;
    if (flowState === "entering") return 66;
    if (flowState === "exiting") return 33;
    return 0;
  }, [flowState]);

  const biometricProps = useMemo(
    () => ({
      heartRate: currentReading?.heartRate || 70,
      stressLevel: currentReading?.stressLevel || 30,
      focusScore: currentReading?.focusScore || 50,
      relaxationScore: currentReading?.relaxationScore || 50,
      flowState,
    }),
    [currentReading, flowState]
  );

  return (
    <div className="space-y-6">
      <div className="py-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-3">
          <Badge className="bg-primary/20 capitalize text-primary">
            {selectedActivityName}
          </Badge>
          <Badge className={cn(flowStateColors[flowState], "text-white")}>
            {flowState === "in-flow" ? "🎯 In Flow!" : flowState}
          </Badge>
        </div>

        <div className="mb-2 text-5xl font-bold tabular-nums">
          {formatTime(elapsedTime)}
        </div>

        <p className="text-muted-foreground">Session in progress</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-muted/50 p-4 text-center">
          <Heart className="mx-auto mb-1 h-5 w-5 animate-pulse text-red-500" />
          <div className="text-2xl font-bold">{currentReading?.heartRate || "--"}</div>
          <div className="text-xs text-muted-foreground">Heart Rate</div>
        </div>

        <div className="rounded-lg bg-muted/50 p-4 text-center">
          <Activity className="mx-auto mb-1 h-5 w-5 text-orange-500" />
          <div className="text-2xl font-bold">{currentReading?.stressLevel ?? "--"}%</div>
          <div className="text-xs text-muted-foreground">Stress</div>
        </div>

        <div className="rounded-lg bg-muted/50 p-4 text-center">
          <Sparkles className="mx-auto mb-1 h-5 w-5 text-purple-500" />
          <div className="text-2xl font-bold">{currentReading?.focusScore ?? "--"}%</div>
          <div className="text-xs text-muted-foreground">Focus</div>
        </div>

        <div className="rounded-lg bg-muted/50 p-4 text-center">
          <Clock className="mx-auto mb-1 h-5 w-5 text-green-500" />
          <div className="text-2xl font-bold">{readingCount}</div>
          <div className="text-xs text-muted-foreground">Readings</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Flow State Progress</span>
          <span className="capitalize">{flowState}</span>
        </div>
        <Progress value={flowProgress} className="h-3" />
      </div>

      <BiometricMusicMapper
        heartRate={biometricProps.heartRate}
        stressLevel={biometricProps.stressLevel}
        focusScore={biometricProps.focusScore}
        relaxationScore={biometricProps.relaxationScore}
        flowState={biometricProps.flowState}
        targetTempo={adaptiveMusicState.currentRecommendation?.targetTempo}
        targetEnergy={adaptiveMusicState.currentRecommendation?.targetEnergy}
        action={adaptiveMusicState.currentRecommendation?.action}
        reasoning={adaptiveMusicState.currentRecommendation?.reasoning}
        isAdaptiveEnabled={adaptiveMusicState.isEnabled}
      />

      {jamendo.currentTrack && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Now Playing</span>
            {autoPlayQueue.state.isEnabled && (
              <Badge variant="secondary" className="text-xs">
                Auto-Play
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            {jamendo.currentTrack.image && (
              <img
                src={jamendo.currentTrack.image}
                alt={jamendo.currentTrack.name}
                className="h-12 w-12 rounded-lg object-cover"
                loading="lazy"
                decoding="async"
              />
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{jamendo.currentTrack.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {jamendo.currentTrack.artist_name}
              </p>
            </div>

            <Button variant="ghost" size="icon" onClick={jamendo.togglePlay}>
              {jamendo.isPlaying ? (
                <Square className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {selectedActivityName && (
        <AdaptiveMusicPanel
          activityType={selectedActivityName}
          biometricState={biometricProps}
          isTracking={true}
          autoPlayEnabled={autoPlayQueue.state.isEnabled}
          onAutoPlayToggle={(enabled) => {
            if (enabled) {
              autoPlayQueue.enableAutoPlay();
              onResetRecommendationDedup();
              void jamendo.loadByMood(selectedActivityName);
            } else {
              autoPlayQueue.disableAutoPlay();
            }
          }}
          queue={autoPlayQueue.state.queue}
          currentQueueTrack={autoPlayQueue.getCurrentTrack()}
          onSkipNext={() => {
            const nextTrack = autoPlayQueue.skipToNext();

            if (nextTrack?.audioUrl) {
              const jamendoTrack = jamendo.tracks.find((t) => t.audio === nextTrack.audioUrl);
              if (jamendoTrack) {
                void jamendo.play(jamendoTrack);
              }
            }
          }}
          onSongRecommended={(song) => {
            toast.success(`Recommended: "${song.title}" by ${song.artist}`);
            if (!autoPlayQueue.state.isEnabled) {
              toast.info("Enable Auto-Play to automatically queue recommended songs");
            }
          }}
        />
      )}

      <LiveAdaptationFeed
        events={adaptationEvents}
        getFeedback={trackFeedback.getFeedback}
        onFeedback={(trackTitle, trackArtist, feedback, event) => {
          trackFeedback.submitFeedback({
            trackTitle,
            trackArtist,
            feedback,
            activityType: selectedActivityName,
            targetTempo: event.details?.targetTempo,
            targetEnergy: event.details?.targetEnergy,
          });
        }}
      />

      {selectedActivityName && (
        <PredictiveQueueBuilder
          activityType={selectedActivityName}
          currentBiometrics={{
            focus: currentReading?.focusScore || 50,
            relaxation: currentReading?.relaxationScore || 50,
            stress: currentReading?.stressLevel || 30,
            heartRate: currentReading?.heartRate || 70,
          }}
          goalFlowScore={70}
          isSessionActive
          onQueueReady={(tracks) => {
            tracks.forEach((track) => {
              autoPlayQueue.addToQueue([track]);
            });
          }}
        />
      )}

      <audio ref={jamendo.audioRef} className="hidden" preload="none" />

      <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Music className="h-4 w-4" />
          Play music to influence your biometrics
        </span>
      </div>

      <Button variant="destructive" onClick={onEndSession} className="w-full" size="lg">
        <Square className="mr-2 h-4 w-4" />
        End Session
      </Button>
    </div>
  );
});

import type { StartingSongRecommendation } from "@/hooks/useActivityStartingSong";

interface ActivityStartingRecommendationProps {
  recommendation: StartingSongRecommendation;
  isLoading: boolean;
  activityName: string;
}

export function ActivityStartingRecommendation({ recommendation, isLoading, activityName }: ActivityStartingRecommendationProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground animate-pulse">
        Finding your ideal starting track for {activityName}…
      </div>
    );
  }

  if (!recommendation.hasHistory || recommendation.topSongs.length === 0) {
    return null;
  }

  const top = recommendation.topSongs[0];
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
      <Music className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Recommended starting track</p>
        <p className="font-medium truncate">{top.title}</p>
        <p className="text-sm text-muted-foreground truncate">{top.artist}</p>
      </div>
    </div>
  );
}

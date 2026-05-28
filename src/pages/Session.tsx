import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bluetooth,
  Brain,
  Cpu,
  HeartPulse,
  Loader2,
  ThumbsDown,
  ThumbsUp,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import type { Track } from "@biomusic/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useSession, useCompleteSession } from "@/features/sessions/hooks";
import { useBiometrics } from "@/features/biometrics/useBiometrics";
import { HealthKitSource } from "@/features/biometrics/healthkit-source";
import { useAdaptiveSession } from "@/features/adaptive/useAdaptiveSession";
import { useSubmitFeedback } from "@/features/feedback/hooks";

const FLOW_LABEL: Record<string, string> = {
  none: "Finding flow",
  entering: "Entering flow",
  in_flow: "In flow",
  exiting: "Drifting",
};

export default function Session() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession(id);
  const completeSession = useCompleteSession();
  const submitFeedback = useSubmitFeedback();

  const activity = session?.activity ?? "study";
  const biometrics = useBiometrics({ activity, sessionId: id });
  const [currentTrack, setCurrentTrack] = useState<Track | undefined>(undefined);

  const adaptive = useAdaptiveSession({
    activity,
    sessionId: id,
    sample: biometrics.current,
    history: biometrics.history,
    currentTrack,
    enabled: biometrics.connected,
  });

  // Running mean instead of an ever-growing array — O(1) memory over a session
  // that may last hours at a 2s sample cadence.
  const flowAcc = useRef({ sum: 0, count: 0 });
  useEffect(() => {
    if (biometrics.current) {
      flowAcc.current.sum += biometrics.flow.score;
      flowAcc.current.count += 1;
    }
  }, [biometrics.current, biometrics.flow.score]);

  // Auto-start the simulator so a session is immediately useful; users can
  // switch to a real device from the controls.
  useEffect(() => {
    if (session && !biometrics.connected) void biometrics.start("simulated");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTrack = useCallback((track: Track) => {
    setCurrentTrack(track);
    if (track.previewUrl && audioRef.current) {
      audioRef.current.src = track.previewUrl;
      void audioRef.current.play().catch(() => undefined);
    }
  }, []);

  const end = async () => {
    biometrics.stop();
    const { sum, count } = flowAcc.current;
    const avg = count ? sum / count : undefined;
    try {
      await completeSession.mutateAsync({ id, avgFlowScore: avg });
      toast.success("Session saved");
      navigate("/history", { replace: true });
    } catch {
      toast.error("Couldn't save the session");
    }
  };

  const rate = (feedback: "up" | "down") => {
    if (!currentTrack) return;
    submitFeedback.mutate({
      trackTitle: currentTrack.title,
      trackArtist: currentTrack.artist,
      feedback,
      activity,
      targetTempo: adaptive.recommendation?.targetTempo,
      targetEnergy: adaptive.recommendation?.targetEnergy,
    });
  };

  const flowPct = useMemo(() => Math.round(biometrics.flow.score * 100), [biometrics.flow.score]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-muted-foreground">Session not found.</p>
        <Button onClick={() => navigate("/dashboard")}>Back to dashboard</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <audio ref={audioRef} className="hidden" />
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{session.activity}</p>
          <Badge variant={biometrics.flow.state === "in_flow" ? "default" : "secondary"}>
            {FLOW_LABEL[biometrics.flow.state]}
          </Badge>
        </div>
        <Button variant="destructive" size="sm" onClick={end} disabled={completeSession.isPending}>
          End
        </Button>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {/* Flow ring + live metrics */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Flow readiness</span>
              <span className="text-3xl font-bold text-primary">{flowPct}%</span>
            </div>
            <Progress value={flowPct} />
            <div className="grid grid-cols-3 gap-3 pt-2">
              <Metric label="Heart rate" value={biometrics.current?.heartRate} unit="bpm" />
              <Metric
                label={biometrics.current?.eeg ? "Meditation" : "Stress"}
                value={biometrics.current?.eeg ? biometrics.current?.meditationScore : biometrics.current?.stressLevel}
                unit="%"
              />
              <Metric label="Focus" value={biometrics.current?.focusScore} unit="%" />
            </div>
            {biometrics.current?.eeg && (
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
                {(["delta", "theta", "alpha", "beta", "gamma"] as const).map((band) => (
                  <span key={band} className="capitalize">
                    {band} {biometrics.current!.eeg![band].toFixed(0)}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source controls */}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            {biometrics.connected ? <Wifi className="h-4 w-4 text-primary" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
            <span className="text-muted-foreground">{biometrics.connected ? "Streaming" : "Disconnected"}</span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <SourceButton icon={Cpu} active={biometrics.sourceId === "simulated"} onClick={() => biometrics.start("simulated")} label="Simulated" />
            <SourceButton icon={Bluetooth} active={biometrics.sourceId === "ble-heart-rate"} onClick={() => biometrics.start("ble-heart-rate")} label="Heart rate" />
            <SourceButton icon={Brain} active={biometrics.sourceId === "muse-eeg"} onClick={() => biometrics.start("muse-eeg")} label="Muse EEG" />
            {HealthKitSource.isSupported() && (
              <SourceButton icon={HeartPulse} active={biometrics.sourceId === "healthkit"} onClick={() => biometrics.start("healthkit")} label="Apple Health" />
            )}
          </div>
        </div>
        {biometrics.error && <p className="text-sm text-destructive">{biometrics.error}</p>}

        {/* Recommendation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Adaptive recommendation</CardTitle>
            <div className="flex items-center gap-2">
              {adaptive.local && <Badge variant="outline">offline engine</Badge>}
              {adaptive.loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {adaptive.recommendation ? (
              <>
                <p className="text-sm">{adaptive.recommendation.reasoning}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">action: {adaptive.recommendation.action.replace("_", " ")}</Badge>
                  <Badge variant="secondary">tempo: {adaptive.recommendation.targetTempo} bpm</Badge>
                  <Badge variant="secondary">energy: {Math.round(adaptive.recommendation.targetEnergy * 100)}%</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{adaptive.recommendation.flowPrediction}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Reading your signals…</p>
            )}
          </CardContent>
        </Card>

        {/* Now playing + candidates */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Now playing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentTrack ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{currentTrack.title}</p>
                  <p className="text-sm text-muted-foreground">{currentTrack.artist}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => rate("up")} aria-label="Like">
                    <ThumbsUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => rate("down")} aria-label="Dislike">
                    <ThumbsDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Pick a track below to start playback.</p>
            )}

            <CandidateList candidates={adaptive.candidates} currentId={currentTrack?.providerTrackId} onPlay={playTrack} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Memoised so it only re-renders when the candidate set or selection changes —
 * not on every 2s biometric tick that re-renders the parent.
 */
const CandidateList = memo(function CandidateList({
  candidates,
  currentId,
  onPlay,
}: {
  candidates: Track[];
  currentId?: string;
  onPlay: (track: Track) => void;
}) {
  if (candidates.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Suggested next</p>
      {candidates.map((track) => (
        <button
          key={`${track.providerTrackId ?? track.title}-${track.artist}`}
          type="button"
          onClick={() => onPlay(track)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
            currentId === track.providerTrackId && "bg-muted",
          )}
        >
          <span className="truncate">
            {track.title} <span className="text-muted-foreground">· {track.artist}</span>
          </span>
        </button>
      ))}
    </div>
  );
});

function Metric({ label, value, unit }: { label: string; value?: number | null; unit: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/30 p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">
        {value != null ? Math.round(value) : "—"}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

function SourceButton({
  icon: Icon,
  active,
  onClick,
  label,
}: {
  icon: typeof Cpu;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button variant={active ? "default" : "outline"} size="sm" onClick={onClick} className="gap-1.5">
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}

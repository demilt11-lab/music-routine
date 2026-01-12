import { useState, useEffect, useCallback } from "react";
import { 
  Play, Square, Music, Activity, Clock, Heart, 
  ChevronRight, Check, Smile, Meh, Frown, Loader2,
  Moon, Dumbbell, BookOpen, Coffee, Car, Sparkles
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useBiometricTracking } from "@/hooks/useBiometricTracking";
import { DeviceConnector } from "./DeviceConnector";
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
  const [isSaving, setIsSaving] = useState(false);

  const { state: biometricState, startTracking, stopTracking, addReading, saveReadingsToSession } = useBiometricTracking();

  // Fetch activity types
  useEffect(() => {
    const fetchActivities = async () => {
      const { data } = await supabase.from("activity_types").select("*");
      if (data) setActivityTypes(data);
    };
    fetchActivities();
  }, []);

  // Timer for active session
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === "active" && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, startTime]);

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

    addReading({
      heartRate,
      heartRateVariability: Math.round(50 - (heartRate - 70) * 0.3 + Math.random() * 10),
      stressLevel: Math.round(baseStress),
      relaxationScore: Math.round(relaxation),
      focusScore: Math.round(focus),
      deviceType: "bluetooth_hr",
      recordedAt: new Date(),
    });
  }, [addReading]);

  const handleEndSession = () => {
    stopTracking();
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
            <DeviceConnector
              onHeartRateUpdate={handleHeartRateUpdate}
              onConnectionChange={setIsDeviceConnected}
            />

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("select-activity")}>
                Back
              </Button>
              <Button onClick={handleStartSession} className="flex-1">
                {isDeviceConnected ? (
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
            <div className="text-center">
              <h3 className="text-xl font-bold mb-2">Session Complete!</h3>
              <p className="text-muted-foreground">
                {formatTime(elapsedTime)} • {biometricState.readings.length} readings
              </p>
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

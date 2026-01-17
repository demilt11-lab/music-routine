import { useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

type NotificationType = 
  | "goal_achieved" 
  | "goal_progress" 
  | "music_adaptation" 
  | "flow_peak" 
  | "stress_alert"
  | "session_milestone";

interface NotificationConfig {
  audioEnabled: boolean;
  hapticEnabled: boolean;
  toastEnabled: boolean;
}

// Audio frequencies for different notification types (Web Audio API)
const NOTIFICATION_SOUNDS: Record<NotificationType, { frequency: number; duration: number; type: OscillatorType; pattern?: number[] }> = {
  goal_achieved: { frequency: 880, duration: 300, type: "sine", pattern: [100, 50, 100, 50, 200] },
  goal_progress: { frequency: 660, duration: 150, type: "sine", pattern: [100, 50, 100] },
  music_adaptation: { frequency: 440, duration: 100, type: "triangle", pattern: [100] },
  flow_peak: { frequency: 1047, duration: 400, type: "sine", pattern: [150, 75, 150, 75, 300] },
  stress_alert: { frequency: 330, duration: 200, type: "square", pattern: [100, 100, 100] },
  session_milestone: { frequency: 523, duration: 250, type: "sine", pattern: [150, 50, 150] },
};

// Haptic patterns (vibration duration arrays in ms)
const HAPTIC_PATTERNS: Record<NotificationType, number[]> = {
  goal_achieved: [100, 50, 100, 50, 200],
  goal_progress: [50, 30, 50],
  music_adaptation: [30],
  flow_peak: [100, 50, 100, 50, 100, 50, 200],
  stress_alert: [200, 100, 200],
  session_milestone: [100, 50, 150],
};

export function useFlowNotifications(config: NotificationConfig = { audioEnabled: true, hapticEnabled: true, toastEnabled: true }) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastNotificationRef = useRef<{ type: NotificationType; time: number } | null>(null);
  const configRef = useRef(config);

  // Update config ref when config changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Initialize Audio Context on first user interaction
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Play audio notification using Web Audio API
  const playAudio = useCallback((type: NotificationType) => {
    if (!configRef.current.audioEnabled) return;

    try {
      const ctx = initAudioContext();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const sound = NOTIFICATION_SOUNDS[type];
      const pattern = sound.pattern || [sound.duration];
      let startTime = ctx.currentTime;

      pattern.forEach((duration, index) => {
        if (index % 2 === 0) {
          // Sound on
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();

          oscillator.type = sound.type;
          oscillator.frequency.setValueAtTime(sound.frequency * (1 + index * 0.1), startTime);

          gainNode.gain.setValueAtTime(0.15, startTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration / 1000);

          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);

          oscillator.start(startTime);
          oscillator.stop(startTime + duration / 1000);
        }
        startTime += duration / 1000;
      });
    } catch (error) {
      console.warn("Audio notification failed:", error);
    }
  }, [initAudioContext]);

  // Trigger haptic feedback using Vibration API
  const triggerHaptic = useCallback((type: NotificationType) => {
    if (!configRef.current.hapticEnabled) return;

    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(HAPTIC_PATTERNS[type]);
      } catch (error) {
        console.warn("Haptic feedback failed:", error);
      }
    }
  }, []);

  // Show toast notification
  const showToast = useCallback((type: NotificationType, message: string, description?: string) => {
    if (!configRef.current.toastEnabled) return;

    const icons: Record<NotificationType, string> = {
      goal_achieved: "🎯",
      goal_progress: "📈",
      music_adaptation: "🎵",
      flow_peak: "⚡",
      stress_alert: "😤",
      session_milestone: "🏆",
    };

    const variants: Record<NotificationType, "success" | "info" | "warning" | "error"> = {
      goal_achieved: "success",
      goal_progress: "info",
      music_adaptation: "info",
      flow_peak: "success",
      stress_alert: "warning",
      session_milestone: "success",
    };

    toast[variants[type]](`${icons[type]} ${message}`, {
      description,
      duration: type === "goal_achieved" || type === "flow_peak" ? 5000 : 3000,
    });
  }, []);

  // Debounced notification to prevent spam
  const notify = useCallback((
    type: NotificationType,
    message: string,
    description?: string,
    options?: { debounceMs?: number; force?: boolean }
  ) => {
    const now = Date.now();
    const debounceMs = options?.debounceMs ?? 2000;

    // Check debounce (unless forced)
    if (!options?.force && lastNotificationRef.current) {
      const timeSinceLast = now - lastNotificationRef.current.time;
      const sameType = lastNotificationRef.current.type === type;
      
      if (sameType && timeSinceLast < debounceMs) {
        return;
      }
    }

    lastNotificationRef.current = { type, time: now };

    // Trigger all notification types
    playAudio(type);
    triggerHaptic(type);
    showToast(type, message, description);
  }, [playAudio, triggerHaptic, showToast]);

  // Specific notification helpers
  const notifyGoalAchieved = useCallback((goalScore: number, currentScore: number) => {
    notify(
      "goal_achieved",
      "Flow Goal Achieved!",
      `You've reached ${Math.round(currentScore)}% flow (target: ${Math.round(goalScore)}%)`,
      { force: true }
    );
  }, [notify]);

  const notifyGoalProgress = useCallback((progress: number, remaining: number) => {
    if (progress >= 90) {
      notify(
        "goal_progress",
        "Almost There!",
        `Just ${Math.round(remaining)}% away from your flow goal`
      );
    } else if (progress >= 75) {
      notify(
        "goal_progress",
        "Great Progress!",
        `${Math.round(progress)}% towards your flow goal`
      );
    }
  }, [notify]);

  const notifyMusicAdaptation = useCallback((reason: string, adjustment: { tempo?: number; energy?: number }) => {
    const changes: string[] = [];
    if (adjustment.tempo) changes.push(`tempo ${adjustment.tempo > 0 ? "+" : ""}${adjustment.tempo} BPM`);
    if (adjustment.energy) changes.push(`energy ${adjustment.energy > 0 ? "+" : ""}${Math.round(adjustment.energy * 100)}%`);

    notify(
      "music_adaptation",
      "Music Adjusted",
      `${reason}${changes.length ? ` (${changes.join(", ")})` : ""}`,
      { debounceMs: 10000 } // Only notify about adaptations every 10 seconds
    );
  }, [notify]);

  const notifyFlowPeak = useCallback((flowScore: number, duration: number) => {
    notify(
      "flow_peak",
      "Peak Flow State!",
      `Sustained ${Math.round(flowScore)}% flow for ${Math.round(duration / 60)}+ minutes`,
      { force: true, debounceMs: 60000 }
    );
  }, [notify]);

  const notifyStressAlert = useCallback((stressLevel: number) => {
    notify(
      "stress_alert",
      "Stress Detected",
      `Adjusting music to help you relax (stress: ${Math.round(stressLevel)}%)`,
      { debounceMs: 30000 }
    );
  }, [notify]);

  const notifySessionMilestone = useCallback((milestone: string, details?: string) => {
    notify(
      "session_milestone",
      milestone,
      details,
      { force: true }
    );
  }, [notify]);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    notify,
    notifyGoalAchieved,
    notifyGoalProgress,
    notifyMusicAdaptation,
    notifyFlowPeak,
    notifyStressAlert,
    notifySessionMilestone,
    // Manual controls
    playAudio,
    triggerHaptic,
  };
}

import { useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export type HapticFeedbackType = 
  | "light" 
  | "medium" 
  | "heavy" 
  | "success" 
  | "warning" 
  | "error"
  | "selection";

/**
 * Hook for native iOS haptic feedback with web fallback
 */
export function useNativeHaptics() {
  const isNative = Capacitor.isNativePlatform();

  const triggerHaptic = useCallback(async (type: HapticFeedbackType = "medium") => {
    if (isNative) {
      try {
        switch (type) {
          case "light":
            await Haptics.impact({ style: ImpactStyle.Light });
            break;
          case "medium":
            await Haptics.impact({ style: ImpactStyle.Medium });
            break;
          case "heavy":
            await Haptics.impact({ style: ImpactStyle.Heavy });
            break;
          case "success":
            await Haptics.notification({ type: NotificationType.Success });
            break;
          case "warning":
            await Haptics.notification({ type: NotificationType.Warning });
            break;
          case "error":
            await Haptics.notification({ type: NotificationType.Error });
            break;
          case "selection":
            await Haptics.selectionStart();
            await Haptics.selectionChanged();
            await Haptics.selectionEnd();
            break;
        }
      } catch (error) {
        console.warn("Native haptic feedback failed:", error);
        fallbackVibration(type);
      }
    } else {
      fallbackVibration(type);
    }
  }, [isNative]);

  const vibrate = useCallback(async (duration: number = 100) => {
    if (isNative) {
      try {
        await Haptics.vibrate({ duration });
      } catch (error) {
        console.warn("Native vibration failed:", error);
        if ("vibrate" in navigator) {
          navigator.vibrate(duration);
        }
      }
    } else if ("vibrate" in navigator) {
      navigator.vibrate(duration);
    }
  }, [isNative]);

  // Button tap feedback
  const tapFeedback = useCallback(() => triggerHaptic("light"), [triggerHaptic]);
  
  // Selection change feedback
  const selectionFeedback = useCallback(() => triggerHaptic("selection"), [triggerHaptic]);
  
  // Success action feedback
  const successFeedback = useCallback(() => triggerHaptic("success"), [triggerHaptic]);
  
  // Error/warning feedback
  const errorFeedback = useCallback(() => triggerHaptic("error"), [triggerHaptic]);

  return {
    triggerHaptic,
    vibrate,
    tapFeedback,
    selectionFeedback,
    successFeedback,
    errorFeedback,
    isNative,
  };
}

// Web fallback vibration patterns
function fallbackVibration(type: HapticFeedbackType) {
  if (!("vibrate" in navigator)) return;
  
  try {
    switch (type) {
      case "light":
        navigator.vibrate(10);
        break;
      case "medium":
        navigator.vibrate(25);
        break;
      case "heavy":
        navigator.vibrate(50);
        break;
      case "success":
        navigator.vibrate([50, 30, 50]);
        break;
      case "warning":
        navigator.vibrate([100, 50, 100]);
        break;
      case "error":
        navigator.vibrate([100, 50, 100, 50, 100]);
        break;
      case "selection":
        navigator.vibrate(5);
        break;
    }
  } catch (error) {
    console.warn("Fallback vibration failed:", error);
  }
}

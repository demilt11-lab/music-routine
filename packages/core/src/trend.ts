import type { BiometricSample, BiometricTrend } from "./types.js";

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/**
 * Compare the most recent window of readings against the preceding window to
 * detect whether the user is trending toward or away from flow. Used by the
 * engine to decide between holding course and intervening.
 */
export function analyzeTrend(history: BiometricSample[]): BiometricTrend {
  if (history.length < 4) {
    return {
      direction: "stable",
      description: "Building baseline — not enough data for a trend yet.",
      focusDelta: 0,
      stressDelta: 0,
    };
  }

  const window = Math.min(5, Math.floor(history.length / 2));
  const recent = history.slice(-window);
  const older = history.slice(-window * 2, -window);

  const focusDelta = avg(recent.map((r) => r.focusScore ?? 50)) - avg(older.map((r) => r.focusScore ?? 50));
  const stressDelta = avg(recent.map((r) => r.stressLevel ?? 50)) - avg(older.map((r) => r.stressLevel ?? 50));

  let direction: BiometricTrend["direction"] = "stable";
  let description = "Metrics are stable — minor adjustments only.";

  if (focusDelta > 5 && stressDelta < -5) {
    direction = "improving";
    description = "Focus rising and stress falling — approaching flow.";
  } else if (focusDelta < -5 && stressDelta > 5) {
    direction = "declining";
    description = "Focus dropping and stress rising — losing flow.";
  } else if (stressDelta > 10) {
    direction = "stress_rising";
    description = "Stress climbing sharply — a calming intervention is needed.";
  } else if (focusDelta > 5) {
    direction = "focus_rising";
    description = "Focus improving while stress holds — stay the course.";
  }

  return { direction, description, focusDelta, stressDelta };
}

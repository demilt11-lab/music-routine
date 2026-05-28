import { Capacitor } from "@capacitor/core";
import { Health, type HealthSample } from "@capgo/capacitor-health";
import type { BiometricSample } from "@biomusic/core";
import type { BiometricSource, SampleHandler } from "./source";

const POLL_MS = 3000;

/**
 * Apple HealthKit source (iOS, via Capacitor). HealthKit is query-based rather
 * than streaming, so we poll the most recent heart-rate and HRV samples on a
 * fixed cadence and synthesise a stress estimate from HRV. Implements the same
 * BiometricSource seam as every other source, so the app is unaware it isn't a
 * live stream.
 */
export class HealthKitSource implements BiometricSource {
  readonly id = "healthkit";
  readonly label = "Apple Health";
  private timer: ReturnType<typeof setInterval> | null = null;

  static isSupported(): boolean {
    return Capacitor.getPlatform() === "ios";
  }

  async start(onSample: SampleHandler): Promise<void> {
    const availability = await Health.isAvailable();
    if (!availability.available) throw new Error(availability.reason ?? "Health data is not available");

    const auth = await Health.requestAuthorization({ read: ["heartRate", "heartRateVariability"] });
    if (!auth.readAuthorized.includes("heartRate")) {
      throw new Error("Heart-rate access was not granted in Apple Health");
    }

    const poll = async () => {
      const sample = await this.readLatest();
      if (sample) onSample(sample);
    };
    await poll();
    this.timer = setInterval(() => void poll(), POLL_MS);
  }

  private async readLatest(): Promise<BiometricSample | null> {
    const since = new Date(Date.now() - 60_000).toISOString();
    const [hr, hrv] = await Promise.all([
      latestValue("heartRate", since),
      latestValue("heartRateVariability", since),
    ]);
    if (hr == null && hrv == null) return null;
    return {
      recordedAt: new Date().toISOString(),
      heartRate: hr ?? undefined,
      hrv: hrv ?? undefined,
      stressLevel: hrv != null ? stressFromHrv(hrv) : undefined,
      deviceType: "healthkit",
    };
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

async function latestValue(dataType: "heartRate" | "heartRateVariability", since: string): Promise<number | null> {
  try {
    const { samples } = await Health.readSamples({ dataType, startDate: since, limit: 1, ascending: false });
    return mostRecent(samples)?.value ?? null;
  } catch {
    return null;
  }
}

function mostRecent(samples: HealthSample[]): HealthSample | undefined {
  return samples.reduce<HealthSample | undefined>(
    (latest, s) => (!latest || s.endDate > latest.endDate ? s : latest),
    undefined,
  );
}

/** Higher HRV (RMSSD, ms) → lower stress. Clamped to a sane 0–100 range. */
function stressFromHrv(hrv: number): number {
  return Math.min(95, Math.max(5, Math.round(100 - hrv)));
}

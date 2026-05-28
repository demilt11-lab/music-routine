import type { Activity, BiometricSample } from "@biomusic/core";
import { getActivityTarget } from "@biomusic/core";

export type SampleHandler = (sample: BiometricSample) => void;

/**
 * A biometric source feeds the adaptive engine. Hardware adapters (Apple
 * HealthKit, EEG headbands, chest straps) implement this same interface, so the
 * rest of the app is agnostic to where signals come from.
 */
export interface BiometricSource {
  readonly id: string;
  readonly label: string;
  start(onSample: SampleHandler): Promise<void>;
  stop(): void;
}

/**
 * Phone-only simulator. Produces plausible, smoothly-evolving signals biased
 * toward the chosen activity so the full product is demoable without hardware
 * — the common case for a new user before they connect a wearable.
 */
export class SimulatedSource implements BiometricSource {
  readonly id = "simulated";
  readonly label = "Simulated (no device)";
  private timer: ReturnType<typeof setInterval> | null = null;
  private hr: number;
  private stress = 45;
  private focus = 50;

  constructor(private activity: Activity) {
    const t = getActivityTarget(activity);
    this.hr = (t.heartRate.min + t.heartRate.max) / 2;
  }

  async start(onSample: SampleHandler): Promise<void> {
    const t = getActivityTarget(this.activity);
    const targetHr = (t.heartRate.min + t.heartRate.max) / 2;
    this.timer = setInterval(() => {
      // Drift toward target with mean-reverting noise.
      this.hr += (targetHr - this.hr) * 0.1 + (Math.random() - 0.5) * 6;
      this.stress += (Math.random() - 0.52) * 5;
      this.focus += (Math.random() - 0.45) * 5;
      this.stress = clamp(this.stress, 5, 95);
      this.focus = clamp(this.focus, 5, 95);
      onSample({
        recordedAt: new Date().toISOString(),
        heartRate: Math.round(this.hr),
        stressLevel: Math.round(this.stress),
        focusScore: Math.round(this.focus),
        relaxationScore: Math.round(100 - this.stress),
        deviceType: "simulated",
      });
    }, 2000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/**
 * Real heart rate over the standard Bluetooth GATT Heart Rate service (0x180D).
 * Works with most chest straps and fitness bands in Chromium browsers. Stress
 * is estimated from beat-to-beat variability as a stand-in until a richer
 * signal (HRV/EEG) is connected.
 */
export class WebBluetoothHeartRateSource implements BiometricSource {
  readonly id = "ble-heart-rate";
  readonly label = "Bluetooth heart rate";
  private device: BluetoothDevice | null = null;
  private char: BluetoothRemoteGATTCharacteristic | null = null;
  private recent: number[] = [];
  private listener = (e: Event) => this.onValue(e);
  private onSample: SampleHandler | null = null;

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  async start(onSample: SampleHandler): Promise<void> {
    if (!WebBluetoothHeartRateSource.isSupported()) throw new Error("Web Bluetooth is not supported on this device");
    this.onSample = onSample;
    this.device = await navigator.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] });
    const server = await this.device.gatt!.connect();
    const service = await server.getPrimaryService("heart_rate");
    this.char = await service.getCharacteristic("heart_rate_measurement");
    await this.char.startNotifications();
    this.char.addEventListener("characteristicvaluechanged", this.listener);
  }

  private onValue(event: Event): void {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value || !this.onSample) return;
    const hr = parseHeartRate(value);
    this.recent.push(hr);
    if (this.recent.length > 10) this.recent.shift();
    this.onSample({
      recordedAt: new Date().toISOString(),
      heartRate: hr,
      stressLevel: estimateStress(this.recent),
      deviceType: "ble-heart-rate",
    });
  }

  stop(): void {
    this.char?.removeEventListener("characteristicvaluechanged", this.listener);
    this.char?.stopNotifications().catch(() => undefined);
    this.device?.gatt?.disconnect();
    this.device = null;
    this.char = null;
    this.recent = [];
  }
}

/** Heart Rate Measurement characteristic: flags byte then 8- or 16-bit value. */
function parseHeartRate(value: DataView): number {
  const flags = value.getUint8(0);
  return flags & 0x01 ? value.getUint16(1, true) : value.getUint8(1);
}

/** Lower beat-to-beat variation → higher estimated stress (0–100). */
function estimateStress(recent: number[]): number {
  if (recent.length < 3) return 50;
  const diffs = recent.slice(1).map((v, i) => Math.abs(v - recent[i]));
  const variability = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  return clamp(Math.round(80 - variability * 8), 5, 95);
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

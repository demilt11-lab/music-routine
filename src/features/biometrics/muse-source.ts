import type { BiometricSample, EegBands } from "@biomusic/core";
import { bandPowers, decodeUnsigned12Bit, rawToMicrovolts, scoresFromBands } from "./eeg-dsp";
import type { BiometricSource, SampleHandler } from "./source";

const MUSE_SERVICE = "0000fe8d-0000-1000-8000-00805f9b34fb";
const CONTROL_CHAR = "273e0001-4c4d-454d-96be-f03bac821358";
// The four EEG electrodes: TP9, AF7, AF8, TP10.
const EEG_CHARS = [
  "273e0003-4c4d-454d-96be-f03bac821358",
  "273e0004-4c4d-454d-96be-f03bac821358",
  "273e0005-4c4d-454d-96be-f03bac821358",
  "273e0006-4c4d-454d-96be-f03bac821358",
];

const WINDOW = 256; // 1s at 256 Hz
const EMIT_MS = 1000;

/**
 * Muse EEG headband over Web Bluetooth. Connects, issues the Muse control
 * commands to start the EEG stream, decodes the packed 12-bit samples to
 * microvolts per channel, and emits band powers + derived cognitive scores once
 * a second. The signal processing lives in `eeg-dsp.ts` and is unit-tested;
 * this file is purely the transport.
 */
export class MuseEegSource implements BiometricSource {
  readonly id = "muse-eeg";
  readonly label = "Muse EEG";
  private device: BluetoothDevice | null = null;
  private control: BluetoothRemoteGATTCharacteristic | null = null;
  private buffers: number[][] = EEG_CHARS.map(() => []);
  private timer: ReturnType<typeof setInterval> | null = null;
  private onSample: SampleHandler | null = null;

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  async start(onSample: SampleHandler): Promise<void> {
    if (!MuseEegSource.isSupported()) throw new Error("Web Bluetooth is not supported on this device");
    this.onSample = onSample;

    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "Muse" }],
      optionalServices: [MUSE_SERVICE],
    });
    const server = await this.device.gatt!.connect();
    const service = await server.getPrimaryService(MUSE_SERVICE);

    this.control = await service.getCharacteristic(CONTROL_CHAR);
    for (let channel = 0; channel < EEG_CHARS.length; channel++) {
      const char = await service.getCharacteristic(EEG_CHARS[channel]);
      char.addEventListener("characteristicvaluechanged", (e) => this.onPacket(channel, e));
      await char.startNotifications();
    }

    // Muse start sequence: halt, select EEG-only preset, then stream.
    await this.send("h");
    await this.send("p21");
    await this.send("d");

    this.timer = setInterval(() => this.emit(), EMIT_MS);
  }

  private async send(command: string): Promise<void> {
    if (!this.control) return;
    const payload = new TextEncoder().encode(`${command}\n`);
    const framed = new Uint8Array([payload.length, ...payload]);
    if (this.control.writeValueWithoutResponse) await this.control.writeValueWithoutResponse(framed);
    else await this.control.writeValue(framed);
  }

  private onPacket(channel: number, event: Event): void {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;
    // First 2 bytes are a packet index; the rest are packed 12-bit samples.
    const raw = decodeUnsigned12Bit(new Uint8Array(value.buffer, value.byteOffset + 2));
    const buf = this.buffers[channel];
    for (const sample of raw) buf.push(rawToMicrovolts(sample));
    if (buf.length > WINDOW) buf.splice(0, buf.length - WINDOW);
  }

  private emit(): void {
    if (!this.onSample) return;
    const ready = this.buffers.filter((b) => b.length >= WINDOW / 4);
    if (ready.length === 0) return;

    // Average band powers across all electrodes with enough data.
    const perChannel = ready.map((b) => bandPowers(b));
    const avg = averageBands(perChannel);
    const scores = scoresFromBands(avg);

    this.onSample({
      recordedAt: new Date().toISOString(),
      eeg: avg,
      ...scores,
      deviceType: "muse-eeg",
    });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.send("h").catch(() => undefined);
    this.device?.gatt?.disconnect();
    this.device = null;
    this.control = null;
    this.buffers = EEG_CHARS.map(() => []);
  }
}

function averageBands(list: EegBands[]): EegBands {
  const keys: (keyof EegBands)[] = ["delta", "theta", "alpha", "beta", "gamma"];
  const out = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
  for (const bands of list) for (const k of keys) out[k] += bands[k];
  for (const k of keys) out[k] /= list.length;
  return out;
}

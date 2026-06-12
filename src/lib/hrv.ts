// Heart-rate variability from BLE RR intervals.
//
// The standard Heart Rate Measurement characteristic (0x2A37) carries the
// beat-to-beat RR intervals most HR straps measure — which is what real HRV
// (RMSSD/SDNN) is computed from. Pure functions, unit-tested in
// src/test/hrv.test.ts.

export interface HeartRateMeasurement {
  heartRate: number;
  /** RR intervals in milliseconds, in arrival order. Empty when absent. */
  rrIntervalsMs: number[];
}

// Flags per Bluetooth GATT spec for 0x2A37:
//   bit 0 — HR value is uint16 (else uint8)
//   bit 3 — Energy Expended field present (uint16)
//   bit 4 — RR-Interval fields present (uint16 each, unit 1/1024 s)
export function parseHeartRateMeasurement(value: DataView): HeartRateMeasurement {
  if (!value || value.byteLength < 2) return { heartRate: 0, rrIntervalsMs: [] };

  const flags = value.getUint8(0);
  const hr16 = (flags & 0x01) !== 0;
  const energyPresent = (flags & 0x08) !== 0;
  const rrPresent = (flags & 0x10) !== 0;

  let offset = 1;
  let heartRate = 0;
  if (hr16) {
    if (value.byteLength < offset + 2) return { heartRate: 0, rrIntervalsMs: [] };
    heartRate = value.getUint16(offset, true);
    offset += 2;
  } else {
    heartRate = value.getUint8(offset);
    offset += 1;
  }

  if (energyPresent) offset += 2;

  const rrIntervalsMs: number[] = [];
  if (rrPresent) {
    while (offset + 2 <= value.byteLength) {
      const raw = value.getUint16(offset, true); // 1/1024 second units
      rrIntervalsMs.push((raw / 1024) * 1000);
      offset += 2;
    }
  }

  return { heartRate, rrIntervalsMs };
}

/** Root mean square of successive differences, in ms. Needs ≥ 2 intervals. */
export function computeRmssd(rrMs: number[]): number | null {
  if (rrMs.length < 2) return null;
  let sumSq = 0;
  for (let i = 1; i < rrMs.length; i++) {
    const d = rrMs[i] - rrMs[i - 1];
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / (rrMs.length - 1));
}

/** Standard deviation of NN intervals, in ms. Needs ≥ 2 intervals. */
export function computeSdnn(rrMs: number[]): number | null {
  if (rrMs.length < 2) return null;
  const mean = rrMs.reduce((a, b) => a + b, 0) / rrMs.length;
  const variance = rrMs.reduce((s, v) => s + (v - mean) ** 2, 0) / (rrMs.length - 1);
  return Math.sqrt(variance);
}

export interface HrvSnapshot {
  rmssd: number;
  sdnn: number;
  sampleCount: number;
}

/**
 * Rolling RR-interval buffer for live HRV. Ectopic beats and dropouts are
 * filtered with a physiological band (250–2000 ms ≈ 30–240 BPM) so a single
 * artifact doesn't blow up RMSSD.
 */
export class RrIntervalBuffer {
  private rr: number[] = [];

  constructor(
    private readonly maxIntervals = 120, // ≈ 1-2 minutes of beats
    private readonly minForSnapshot = 8,
  ) {}

  push(intervalsMs: number[]): void {
    for (const rr of intervalsMs) {
      if (rr < 250 || rr > 2000) continue; // artifact / dropout
      this.rr.push(rr);
    }
    if (this.rr.length > this.maxIntervals) {
      this.rr = this.rr.slice(-this.maxIntervals);
    }
  }

  snapshot(): HrvSnapshot | null {
    if (this.rr.length < this.minForSnapshot) return null;
    const rmssd = computeRmssd(this.rr);
    const sdnn = computeSdnn(this.rr);
    if (rmssd === null || sdnn === null) return null;
    return { rmssd, sdnn, sampleCount: this.rr.length };
  }

  reset(): void {
    this.rr = [];
  }
}

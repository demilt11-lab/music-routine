import { describe, expect, it } from "vitest";
import {
  computeRmssd,
  computeSdnn,
  parseHeartRateMeasurement,
  RrIntervalBuffer,
} from "../lib/hrv";

function dataView(bytes: number[]): DataView {
  return new DataView(new Uint8Array(bytes).buffer);
}

// RR values are uint16 little-endian in 1/1024s units; 1024 raw = 1000 ms
const RR_1000MS = [0x00, 0x04]; // 1024
const RR_900MS = [0x9a, 0x03];  // 922 ≈ 900.4 ms

describe("parseHeartRateMeasurement (BLE 0x2A37)", () => {
  it("parses uint8 HR with no RR intervals", () => {
    const m = parseHeartRateMeasurement(dataView([0x00, 72]));
    expect(m.heartRate).toBe(72);
    expect(m.rrIntervalsMs).toEqual([]);
  });

  it("parses uint16 HR (flag bit 0)", () => {
    const m = parseHeartRateMeasurement(dataView([0x01, 0x2c, 0x01])); // 300 LE
    expect(m.heartRate).toBe(300);
  });

  it("parses RR intervals (flag bit 4) into milliseconds", () => {
    const m = parseHeartRateMeasurement(dataView([0x10, 60, ...RR_1000MS, ...RR_900MS]));
    expect(m.heartRate).toBe(60);
    expect(m.rrIntervalsMs).toHaveLength(2);
    expect(m.rrIntervalsMs[0]).toBeCloseTo(1000, 0);
    expect(m.rrIntervalsMs[1]).toBeCloseTo(900.4, 0);
  });

  it("skips the Energy Expended field (flag bit 3) before RR", () => {
    const m = parseHeartRateMeasurement(dataView([0x18, 60, 0xff, 0xff, ...RR_1000MS]));
    expect(m.heartRate).toBe(60);
    expect(m.rrIntervalsMs).toHaveLength(1);
    expect(m.rrIntervalsMs[0]).toBeCloseTo(1000, 0);
  });

  it("returns zero HR for malformed payloads", () => {
    expect(parseHeartRateMeasurement(dataView([0x01])).heartRate).toBe(0);
  });
});

describe("RMSSD / SDNN", () => {
  it("computes RMSSD over successive differences", () => {
    // diffs: +50, -50, +50 → RMSSD = sqrt(mean(2500,2500,2500)) = 50
    expect(computeRmssd([800, 850, 800, 850])).toBeCloseTo(50, 5);
  });

  it("computes SDNN as the sample standard deviation", () => {
    expect(computeSdnn([800, 800, 800])).toBeCloseTo(0, 5);
    expect(computeSdnn([700, 900])).toBeCloseTo(Math.sqrt(20000), 3);
  });

  it("needs at least two intervals", () => {
    expect(computeRmssd([800])).toBeNull();
    expect(computeSdnn([])).toBeNull();
  });
});

describe("RrIntervalBuffer", () => {
  it("withholds a snapshot until enough beats arrive", () => {
    const buf = new RrIntervalBuffer(120, 8);
    buf.push([800, 810, 805]);
    expect(buf.snapshot()).toBeNull();
    buf.push([800, 810, 805, 800, 810]);
    const snap = buf.snapshot();
    expect(snap).not.toBeNull();
    expect(snap!.sampleCount).toBe(8);
    expect(snap!.rmssd).toBeGreaterThan(0);
  });

  it("filters physiologically impossible intervals (artifacts)", () => {
    const buf = new RrIntervalBuffer(120, 4);
    buf.push([800, 50, 810, 5000, 805, 800]); // 50ms and 5000ms are artifacts
    expect(buf.snapshot()!.sampleCount).toBe(4);
  });

  it("caps the rolling buffer length", () => {
    const buf = new RrIntervalBuffer(10, 4);
    buf.push(Array.from({ length: 50 }, () => 800));
    expect(buf.snapshot()!.sampleCount).toBe(10);
  });
});

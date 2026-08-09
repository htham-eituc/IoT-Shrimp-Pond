import { describe, expect, it } from "vitest";
import type { KeyedRecord, TelemetryRecord } from "../domain";
import { buildTelemetryChartGeometry, chronologicalTelemetry } from "./telemetryHistory";

function record(timestampMs: number, ph: number, rain = false): KeyedRecord<TelemetryRecord> {
  return {
    id: String(timestampMs),
    value: {
      timestampMs,
      ph,
      do: 5.5,
      temperature: 30,
      waterLevel: 70,
      rain,
      ec: 18,
      salinity: 20,
    },
  };
}

describe("telemetry history presentation", () => {
  it("sorts recent Firebase records chronologically without mutating input", () => {
    const input = [record(3_000, 7.9), record(1_000, 7.7), record(2_000, 7.8)];
    const sorted = chronologicalTelemetry(input);

    expect(sorted.map((item) => item.value.timestampMs)).toEqual([1_000, 2_000, 3_000]);
    expect(input.map((item) => item.value.timestampMs)).toEqual([3_000, 1_000, 2_000]);
  });

  it("maps boolean rain samples to chart regions without inventing rainfall rates", () => {
    const records = [record(1_000, 7.7), record(2_000, 7.8, true), record(3_000, 7.9)];
    const geometry = buildTelemetryChartGeometry(records, "ph", 600, 170);

    expect(geometry.points).toHaveLength(3);
    expect(geometry.rainRegions).toHaveLength(1);
    expect(geometry).not.toHaveProperty("rainfallRate");
    expect(geometry.min).toBe(7.7);
    expect(geometry.max).toBe(7.9);
  });
});

import type { KeyedRecord, TelemetryRecord } from "../domain";

export type HistoryMetricKey = "ph" | "do" | "temperature" | "waterLevel" | "ec" | "salinity";

export interface HistoryMetricDefinition {
  key: HistoryMetricKey;
  label: string;
  unit: string;
  decimals: number;
}

export const HISTORY_METRICS: ReadonlyArray<HistoryMetricDefinition> = [
  { key: "ph", label: "pH", unit: "", decimals: 2 },
  { key: "do", label: "Dissolved oxygen", unit: "mg/L", decimals: 2 },
  { key: "temperature", label: "Temperature", unit: "°C", decimals: 1 },
  { key: "waterLevel", label: "Water level", unit: "%", decimals: 0 },
  { key: "ec", label: "Electrical conductivity", unit: "", decimals: 2 },
  { key: "salinity", label: "Estimated salinity", unit: "ppt", decimals: 1 },
];

export function chronologicalTelemetry(
  records: Array<KeyedRecord<TelemetryRecord>>,
): Array<KeyedRecord<TelemetryRecord>> {
  return [...records].sort((left, right) => left.value.timestampMs - right.value.timestampMs);
}

export interface ChartPoint {
  x: number;
  y: number;
}

export interface RainRegion {
  x: number;
  width: number;
}

export interface TelemetryChartGeometry {
  points: ChartPoint[];
  rainRegions: RainRegion[];
  min: number;
  max: number;
}

export function buildTelemetryChartGeometry(
  records: Array<KeyedRecord<TelemetryRecord>>,
  metric: HistoryMetricKey,
  width = 600,
  height = 170,
): TelemetryChartGeometry {
  if (records.length === 0) {
    return { points: [], rainRegions: [], min: 0, max: 0 };
  }

  const values = records.map((record) => record.value[metric]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = rawMin === rawMax ? Math.max(Math.abs(rawMin) * 0.05, 1) : (rawMax - rawMin) * 0.12;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const range = max - min;
  const xForIndex = (index: number) => (records.length === 1 ? width / 2 : (index / (records.length - 1)) * width);
  const sampleWidth = records.length === 1 ? width : width / (records.length - 1);

  return {
    points: values.map((value, index) => ({
      x: xForIndex(index),
      y: height - ((value - min) / range) * height,
    })),
    rainRegions: records.flatMap((record, index) => {
      if (!record.value.rain) return [];
      const center = xForIndex(index);
      const regionWidth = Math.min(width, sampleWidth);
      return [{ x: Math.max(0, center - regionWidth / 2), width: Math.min(regionWidth, width - Math.max(0, center - regionWidth / 2)) }];
    }),
    min: rawMin,
    max: rawMax,
  };
}

import type { PondDevices, PondState, PondStatus } from "../../domain";
import type { MetricTone, MetricViewModel, SensorMetricKey } from "../../presentation/metrics";

const MIN_WATER_Y = -0.42;
const MAX_WATER_Y = 0.34;

export interface PondSceneModel {
  status: PondStatus;
  waterLevel: number;
  waterSurfaceY: number;
  rain: boolean;
  devices: Readonly<PondDevices>;
}

export type PondProbeKey = Extract<SensorMetricKey, "do" | "ph" | "temperature">;

export interface PondProbeReading {
  key: PondProbeKey;
  label: string;
  value: string;
  unit: string;
  state: string;
  tone: MetricTone;
}

const PROBE_KEYS = new Set<PondProbeKey>(["do", "ph", "temperature"]);

export function createPondSceneModel(pond: PondState): PondSceneModel {
  const waterLevel = clamp(pond.sensors.waterLevel, 0, 100);
  return {
    status: pond.status,
    waterLevel,
    waterSurfaceY: MIN_WATER_Y + (waterLevel / 100) * (MAX_WATER_Y - MIN_WATER_Y),
    rain: pond.sensors.rain,
    devices: { ...pond.devices },
  };
}

export function createPondProbeReadings(metrics: readonly MetricViewModel[]): PondProbeReading[] {
  return metrics
    .filter((metric): metric is MetricViewModel & { key: PondProbeKey } => PROBE_KEYS.has(metric.key as PondProbeKey))
    .map(({ key, label, value, unit, state, tone }) => ({ key, label, value, unit, state, tone }));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

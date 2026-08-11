import { Vector3 } from "three";
import type { CommandDevice } from "../../domain";
import type { SensorMetricKey } from "../../presentation/metrics";
import { createPondProjectionCamera } from "./pondCamera";
import type { PondProbeKey, PondSceneModel } from "./pondSceneModel";

export type PondAnchorKey =
  | PondProbeKey
  | Extract<SensorMetricKey, "waterLevel">
  | Extract<CommandDevice, "aerator" | "drainagePump" | "dilutionPump" | "feeder" | "buzzer" | "warningBeacon">;

export type PondWorldPoint = readonly [number, number, number];

export interface PondAnchorProjection {
  left: number;
  top: number;
  visible: boolean;
  edge: "left" | "center" | "right";
}

export function createPondAnchorWorldPoints(model: PondSceneModel): Record<PondAnchorKey, PondWorldPoint> {
  const waterY = model.waterSurfaceY;
  return {
    do: [-1.35, waterY + 0.85, -0.25],
    ph: [0, waterY + 0.85, -0.25],
    temperature: [1.35, waterY + 0.85, -0.25],
    waterLevel: [0, waterY + 0.05, 1.55],
    aerator: [-2.5, waterY + 0.45, 0.55],
    drainagePump: [-4.65, 0.06, 1.35],
    dilutionPump: [4.65, 0.16, -1.35],
    feeder: [0, 1.09, -1.1],
    buzzer: [3.55, 0.62, 2.92],
    warningBeacon: [4.25, 1.3, 2.95],
  };
}

export function projectPondAnchor(
  point: PondWorldPoint,
  viewport: { width: number; height: number },
): PondAnchorProjection {
  const camera = createPondProjectionCamera(viewport.width / Math.max(viewport.height, 1));
  const projected = new Vector3(...point).project(camera);
  const left = ((projected.x + 1) / 2) * viewport.width;
  const top = ((-projected.y + 1) / 2) * viewport.height;
  return {
    left,
    top,
    visible: projected.z >= -1 && projected.z <= 1,
    edge: left < 96 ? "left" : left > viewport.width - 96 ? "right" : "center",
  };
}

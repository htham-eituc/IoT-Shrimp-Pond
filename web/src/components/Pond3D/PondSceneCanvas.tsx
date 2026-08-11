import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import type { PondState } from "../../domain";
import { PondScene } from "./PondScene";
import { createPondSceneModel } from "./pondSceneModel";
import type { PondProbeReading } from "./pondSceneModel";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { usePond3DQuality } from "./pondQuality";
import { POND_CAMERA_FAR, POND_CAMERA_FOV, POND_CAMERA_NEAR, POND_CAMERA_POSITION } from "./pondCamera";

const QUALITY_CONFIG = {
  high: { dpr: [1, 1.75] as [number, number], antialias: true },
  balanced: { dpr: [1, 1.35] as [number, number], antialias: true },
  low: { dpr: 1, antialias: false },
};

export default function PondSceneCanvas({ pond, probes, onFailure }: { pond: PondState; probes: readonly PondProbeReading[]; onFailure(): void }) {
  const model = useMemo(() => createPondSceneModel(pond), [pond]);
  const reducedMotion = usePrefersReducedMotion();
  const quality = usePond3DQuality(reducedMotion);
  const qualityConfig = QUALITY_CONFIG[quality];
  const animated = !reducedMotion && (
    model.rain ||
    model.devices.aerator ||
    model.devices.drainagePump ||
    model.devices.dilutionPump ||
    model.devices.feeder ||
    model.devices.warningBeacon ||
    model.devices.buzzer
  );

  return (
    <div className="pond-3d__canvas" data-quality={quality} data-reduced-motion={reducedMotion ? "true" : "false"} aria-hidden="true">
      <Canvas
        camera={{ fov: POND_CAMERA_FOV, near: POND_CAMERA_NEAR, far: POND_CAMERA_FAR, position: [...POND_CAMERA_POSITION] }}
        dpr={qualityConfig.dpr}
        frameloop={animated ? "always" : "demand"}
        shadows={quality !== "low" ? "percentage" : false}
        gl={{
          antialias: qualityConfig.antialias,
          alpha: false,
          powerPreference: quality === "high" ? "high-performance" : "low-power",
        }}
      >
        <PondScene model={model} probes={probes} reducedMotion={reducedMotion} quality={quality} onFailure={onFailure} />
      </Canvas>
    </div>
  );
}

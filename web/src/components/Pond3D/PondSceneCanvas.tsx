import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import type { PondState } from "../../domain";
import { PondScene } from "./PondScene";
import { createPondSceneModel } from "./pondSceneModel";
import type { PondProbeReading } from "./pondSceneModel";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { usePond3DQuality } from "./pondQuality";

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
        camera={{ fov: 37, near: 0.1, far: 45, position: [8.7, 6.6, 8.4] }}
        dpr={qualityConfig.dpr}
        frameloop={animated ? "always" : "demand"}
        gl={{ antialias: qualityConfig.antialias, alpha: false, powerPreference: quality === "high" ? "high-performance" : "low-power" }}
      >
        <PondScene model={model} probes={probes} reducedMotion={reducedMotion} quality={quality} onFailure={onFailure} />
      </Canvas>
    </div>
  );
}

import type { PondProbeReading, PondSceneModel } from "./pondSceneModel";
import { AeratorModel } from "./AeratorModel";
import { BuzzerIndicator } from "./BuzzerIndicator";
import { CameraRig } from "./CameraRig";
import { DilutionIntake } from "./DilutionIntake";
import { DrainageOutlet } from "./DrainageOutlet";
import { FeederModel } from "./FeederModel";
import { PondBasin } from "./PondBasin";
import { PondEnvironment } from "./PondEnvironment";
import { PondStatusMarker } from "./PondStatusMarker";
import { RainEffect } from "./RainEffect";
import { SceneHealthMonitor } from "./SceneHealthMonitor";
import { SensorProbe } from "./SensorProbe";
import { WarningBeacon } from "./WarningBeacon";
import { WaterSurface } from "./WaterSurface";
import { WaterBoundEquipment } from "./WaterBoundEquipment";
import type { Pond3DQuality } from "./pondQuality";

export function PondScene({ model, probes, reducedMotion, quality, onFailure }: { model: PondSceneModel; probes: readonly PondProbeReading[]; reducedMotion: boolean; quality: Pond3DQuality; onFailure(): void }) {
  const animatedWater = !reducedMotion && (model.devices.aerator || model.devices.drainagePump || model.devices.dilutionPump);
  const probeTone = (key: PondProbeReading["key"]) => probes.find((probe) => probe.key === key)?.tone ?? "info";

  return (
    <>
      <SceneHealthMonitor onFailure={onFailure} />
      <CameraRig />
      <PondEnvironment />
      <PondBasin />
      <WaterSurface surfaceY={model.waterSurfaceY} rain={model.rain} animate={animatedWater} reducedMotion={reducedMotion} quality={quality} />
      <WaterBoundEquipment targetY={model.waterSurfaceY} reducedMotion={reducedMotion}>
        <AeratorModel position={[-2.5, 0.03, 0.55]} active={model.devices.aerator} reducedMotion={reducedMotion} quality={quality} />
        <AeratorModel position={[2.5, 0.03, 0.55]} active={model.devices.aerator} reducedMotion={reducedMotion} quality={quality} />
        <SensorProbe position={[-1.35, 0.05, -0.25]} tone={probeTone("do")} />
        <SensorProbe position={[0, 0.05, -0.25]} tone={probeTone("ph")} />
        <SensorProbe position={[1.35, 0.05, -0.25]} tone={probeTone("temperature")} />
      </WaterBoundEquipment>
      <DrainageOutlet active={model.devices.drainagePump} reducedMotion={reducedMotion} />
      <DilutionIntake active={model.devices.dilutionPump} reducedMotion={reducedMotion} />
      <FeederModel active={model.devices.feeder} reducedMotion={reducedMotion} quality={quality} />
      <PondStatusMarker status={model.status} />
      <WarningBeacon active={model.devices.warningBeacon} status={model.status} reducedMotion={reducedMotion} />
      <BuzzerIndicator active={model.devices.buzzer} reducedMotion={reducedMotion} />
      <RainEffect active={model.rain} reducedMotion={reducedMotion} quality={quality} />
    </>
  );
}

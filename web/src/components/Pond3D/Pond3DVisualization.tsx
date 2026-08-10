import { Component, lazy, Suspense, useCallback, useState, type ReactNode } from "react";
import { Box } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CommandDevice, PondState } from "../../domain";
import type { SensorMetricKey } from "../../presentation/metrics";
import { useLocaleFormatters } from "../../i18n/formatters";
import { PondVisualization } from "../PondVisualization";
import { createPond3DDescription, detectWebGLSupport } from "./pondAccessibility";
import { ProbeInspector } from "./ProbeInspector";
import { SceneInteractionLayer } from "./SceneInteractionLayer";
import type { PondProbeReading } from "./pondSceneModel";

const PondSceneCanvas = lazy(() => import("./PondSceneCanvas"));

export function Pond3DVisualization({
  pond,
  probes,
  onSelectSensor,
  onSelectDevice,
  onShowAlerts,
}: {
  pond: PondState;
  probes: readonly PondProbeReading[];
  onSelectSensor(sensor: SensorMetricKey): void;
  onSelectDevice(device: CommandDevice): void;
  onShowAlerts(): void;
}) {
  const { t } = useTranslation(["common", "dashboard", "devices"]);
  const formatters = useLocaleFormatters();
  const [sceneFailed, setSceneFailed] = useState(false);
  const [webGLSupported] = useState(detectWebGLSupport);
  const handleFailure = useCallback(() => setSceneFailed(true), []);
  const description = createPond3DDescription(pond, t, formatters.percentage);
  const fallback = <PondFallback pond={pond} failed={sceneFailed || !webGLSupported} />;

  if (sceneFailed || !webGLSupported) return fallback;

  return (
    <figure className={`pond-3d pond-3d--${pond.status}`} aria-labelledby="pond-3d-title" aria-describedby="pond-3d-description">
      <span className="pond-3d__badge" id="pond-3d-title"><Box aria-hidden="true" />{t("pond3d.liveView", { ns: "dashboard" })}</span>
      <SceneErrorBoundary fallback={fallback} onError={handleFailure}>
        <Suspense fallback={<PondFallback pond={pond} loading />}>
          <PondSceneCanvas pond={pond} probes={probes} onFailure={handleFailure} />
        </Suspense>
      </SceneErrorBoundary>
      <ProbeInspector probes={probes} onActivate={(probe) => onSelectSensor(probe.key)} />
      <SceneInteractionLayer onSelectSensor={onSelectSensor} onSelectDevice={onSelectDevice} onShowAlerts={onShowAlerts} />
      <figcaption className="pond-3d__description" id="pond-3d-description">{description}</figcaption>
    </figure>
  );
}

function PondFallback({ pond, loading = false, failed = false }: { pond: PondState; loading?: boolean; failed?: boolean }) {
  const { t } = useTranslation("dashboard");
  return (
    <div className="pond-3d-fallback">
      <PondVisualization pond={pond} />
      <span className="pond-3d-fallback__label" role="status">
        {t(loading ? "pond3d.loading" : failed ? "pond3d.fallback" : "pond3d.loading")}
      </span>
    </div>
  );
}

class SceneErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError(): void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

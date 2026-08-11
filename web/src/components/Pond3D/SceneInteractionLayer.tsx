import { useTranslation } from "react-i18next";
import type { CommandDevice } from "../../domain";
import type { SensorMetricKey } from "../../presentation/metrics";
import type { PondAnchorKey, PondWorldPoint } from "./pondAnchors";
import { usePondAnchorProjection } from "./usePondAnchorProjection";

export function SceneInteractionLayer({
  anchors,
  onSelectSensor,
  onSelectDevice,
  onShowAlerts,
}: {
  anchors: Partial<Record<PondAnchorKey, PondWorldPoint>>;
  onSelectSensor(sensor: SensorMetricKey): void;
  onSelectDevice(device: CommandDevice): void;
  onShowAlerts(): void;
}) {
  const { t } = useTranslation(["dashboard", "devices", "sensors"]);
  const { layerRef, registerAnchor } = usePondAnchorProjection(anchors);
  return (
    <div className="pond-3d-interactions" ref={layerRef} aria-label={t("pond3d.interactionsLabel", { ns: "dashboard" })}>
      <button ref={registerAnchor("waterLevel")} className="pond-3d-hotspot pond-3d-hotspot--water" type="button" onClick={() => onSelectSensor("waterLevel")}>
        <span>{t("pond3d.inspectWater", { ns: "dashboard" })}</span>
      </button>
      <button ref={registerAnchor("aerator")} className="pond-3d-hotspot pond-3d-hotspot--aerator" type="button" onClick={() => onSelectDevice("aerator")}>
        <span>{t("pond3d.inspectDevice", { ns: "dashboard", device: t("aerator.label", { ns: "devices" }) })}</span>
      </button>
      <button ref={registerAnchor("drainagePump")} className="pond-3d-hotspot pond-3d-hotspot--drainage" type="button" onClick={() => onSelectDevice("drainagePump")}>
        <span>{t("pond3d.inspectDevice", { ns: "dashboard", device: t("drainagePump.label", { ns: "devices" }) })}</span>
      </button>
      <button ref={registerAnchor("dilutionPump")} className="pond-3d-hotspot pond-3d-hotspot--dilution" type="button" onClick={() => onSelectDevice("dilutionPump")}>
        <span>{t("pond3d.inspectDevice", { ns: "dashboard", device: t("dilutionPump.label", { ns: "devices" }) })}</span>
      </button>
      <button ref={registerAnchor("feeder")} className="pond-3d-hotspot pond-3d-hotspot--feeder" type="button" onClick={() => onSelectDevice("feeder")}>
        <span>{t("pond3d.inspectDevice", { ns: "dashboard", device: t("feeder.label", { ns: "devices" }) })}</span>
      </button>
      <button ref={registerAnchor("warningBeacon")} className="pond-3d-hotspot pond-3d-hotspot--beacon" type="button" onClick={onShowAlerts}>
        <span>{t("pond3d.inspectAlerts", { ns: "dashboard" })}</span>
      </button>
    </div>
  );
}

import { useTranslation } from "react-i18next";
import type { CommandDevice } from "../../domain";
import type { SensorMetricKey } from "../../presentation/metrics";

export function SceneInteractionLayer({
  onSelectSensor,
  onSelectDevice,
  onShowAlerts,
}: {
  onSelectSensor(sensor: SensorMetricKey): void;
  onSelectDevice(device: CommandDevice): void;
  onShowAlerts(): void;
}) {
  const { t } = useTranslation(["dashboard", "devices", "sensors"]);
  return (
    <div className="pond-3d-interactions" aria-label={t("pond3d.interactionsLabel", { ns: "dashboard" })}>
      <button className="pond-3d-hotspot pond-3d-hotspot--water" type="button" onClick={() => onSelectSensor("waterLevel")}>
        <span>{t("pond3d.inspectWater", { ns: "dashboard" })}</span>
      </button>
      <button className="pond-3d-hotspot pond-3d-hotspot--aerator" type="button" onClick={() => onSelectDevice("aerator")}>
        <span>{t("pond3d.inspectDevice", { ns: "dashboard", device: t("aerator.label", { ns: "devices" }) })}</span>
      </button>
      <button className="pond-3d-hotspot pond-3d-hotspot--feeder" type="button" onClick={() => onSelectDevice("feeder")}>
        <span>{t("pond3d.inspectDevice", { ns: "dashboard", device: t("feeder.label", { ns: "devices" }) })}</span>
      </button>
      <button className="pond-3d-hotspot pond-3d-hotspot--beacon" type="button" onClick={onShowAlerts}>
        <span>{t("pond3d.inspectAlerts", { ns: "dashboard" })}</span>
      </button>
    </div>
  );
}

import { useCallback, useMemo, useState } from "react";
import { BellRing, ChartNoAxesCombined, Gauge, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  Command,
  CommandDevice,
  KeyedRecord,
  PondAlert,
  PondSettings,
  PondState,
  TelemetryRecord,
} from "../domain";
import type { PondDataSource } from "../data";
import {
  createMetricViewModels,
  createPrimaryMetricViewModels,
  getPrimaryMetricKeyForSensor,
  metricSeverity,
} from "../presentation/metrics";
import type { SensorMetricKey } from "../presentation/metrics";
import type { ConnectionState } from "../presentation/connection";
import { ActiveAlertsPanel } from "./ActiveAlertsPanel";
import { CompactDeviceControls } from "./CompactDeviceControls";
import { MetricCard } from "./MetricCard";
import { Pond3DVisualization } from "./Pond3D";
import { createPondProbeReadings } from "./Pond3D/pondSceneModel";
import { StatusBadge } from "./StatusBadge";
import { SimulationControls } from "./SimulationControls";

export type DetailView = "realtime" | "control" | "history" | "settings" | "alerts";

interface CommandCenterViewProps {
  dataSource: PondDataSource;
  pondId: string;
  pond: PondState;
  settings: PondSettings | null;
  alerts: Array<KeyedRecord<PondAlert>>;
  commands: Array<KeyedRecord<Command>>;
  telemetry: Array<KeyedRecord<TelemetryRecord>>;
  connectionState: ConnectionState;
  onOpenDetail(view: DetailView): void;
}

export function CommandCenterView({
  dataSource,
  pondId,
  pond,
  settings,
  alerts,
  commands,
  telemetry,
  connectionState,
  onOpenDetail,
}: CommandCenterViewProps) {
  const { t, i18n } = useTranslation(["common", "dashboard"]);
  const metrics = useMemo(
    () => createMetricViewModels(pond.sensors, settings, alerts, telemetry, t, i18n.resolvedLanguage ?? i18n.language),
    [alerts, i18n.language, i18n.resolvedLanguage, pond.sensors, settings, t, telemetry],
  );
  const probes = useMemo(() => createPondProbeReadings(metrics), [metrics]);
  const prioritizedMetrics = useMemo(
    () => createPrimaryMetricViewModels(metrics).sort((left, right) => metricSeverity(right.tone) - metricSeverity(left.tone)),
    [metrics],
  );
  const [focusedSensor, setFocusedSensor] = useState<SensorMetricKey | null>(null);
  const [focusedDevice, setFocusedDevice] = useState<CommandDevice | null>(null);
  const hasCriticalAlert = alerts.some((alert) => alert.value.status === "active" && alert.value.severity === "critical");

  const focusSensor = useCallback((sensor: SensorMetricKey) => {
    setFocusedSensor(sensor);
    setFocusedDevice(null);
    const primaryMetric = getPrimaryMetricKeyForSensor(sensor);
    window.requestAnimationFrame(() => document.getElementById(`command-metric-${primaryMetric}`)?.focus());
  }, []);

  const focusDevice = useCallback((device: CommandDevice) => {
    setFocusedDevice(device);
    setFocusedSensor(null);
    window.requestAnimationFrame(() => document.getElementById(`command-device-${device}`)?.focus());
  }, []);

  return (
    <div className={`command-center${hasCriticalAlert ? " command-center--critical-alert" : ""}`} aria-label={t("commandCenter.ariaLabel", { ns: "dashboard" })}>
      <section className={`command-center__pond panel command-center__pond--${pond.status}`} aria-labelledby="command-pond-title">
        <header className="command-panel-heading">
          <div>
            <span className="eyebrow">{t("commandCenter.livePond", { ns: "dashboard" })}</span>
            <h1 id="command-pond-title">{pond.name}</h1>
          </div>
          <span className="pond-health-badge"><StatusBadge label={t(`status.${pond.status}`, { ns: "common" })} tone={pond.status} /></span>
          <div className="command-quick-actions" aria-label={t("commandCenter.detailActions", { ns: "dashboard" })}>
            <button type="button" className="command-link" onClick={() => onOpenDetail("history")}>
              <ChartNoAxesCombined aria-hidden="true" /> {t("commandCenter.viewHistory", { ns: "dashboard" })}
            </button>
            <button type="button" className="command-link" onClick={() => onOpenDetail("settings")}>
              <Settings2 aria-hidden="true" /> {t("commandCenter.settings", { ns: "dashboard" })}
            </button>
          </div>
        </header>

        <SimulationControls
          dataSource={dataSource}
          pondId={pondId}
          mode={settings?.mode ?? null}
          connected={pond.connected}
        />

        <div className="command-center__visualization">
          <Pond3DVisualization
            pond={pond}
            probes={probes}
            onSelectSensor={focusSensor}
            onSelectDevice={focusDevice}
            onShowAlerts={() => onOpenDetail("alerts")}
          />
          {connectionState === "offline" && (
            <div className={`command-connection-overlay command-connection-overlay--${connectionState}`} role="status">
              <strong>{t(`connection.${connectionState}`, { ns: "common" })}</strong>
              <span>{t("overview.disconnectedDescription", { ns: "dashboard" })}</span>
            </div>
          )}
        </div>
      </section>

      <aside className="command-center__side">
        <div className="command-center__alerts">
          <ActiveAlertsPanel
            alerts={alerts}
            compact
            limit={hasCriticalAlert ? 1 : 2}
            action={(
              <button className="command-link" type="button" onClick={() => onOpenDetail("alerts")}>
                <BellRing aria-hidden="true" /> {t("commandCenter.allAlerts", { ns: "dashboard" })}
              </button>
            )}
          />
        </div>
        <section className="command-sensors panel" aria-labelledby="command-sensors-title">
          <header className="command-section-heading">
            <div>
              <span className="eyebrow">{t("realtime.eyebrow", { ns: "dashboard" })}</span>
              <h2 id="command-sensors-title">{t("commandCenter.sensorMatrix", { ns: "dashboard" })}</h2>
            </div>
            <button className="command-link" type="button" onClick={() => onOpenDetail("realtime")}>
              <Gauge aria-hidden="true" /> {t("commandCenter.sensorDetails", { ns: "dashboard" })}
            </button>
          </header>
          <div className="compact-metric-grid">
            {prioritizedMetrics.map((metric) => (
              <MetricCard
                key={metric.key}
                id={`command-metric-${metric.key}`}
                metric={metric}
                compact
                highlighted={focusedSensor === metric.key || (metric.key === "salinity" && focusedSensor === "ec")}
              />
            ))}
          </div>
        </section>
      </aside>

      <div className="command-center__devices panel">
        {settings ? (
          <CompactDeviceControls
            dataSource={dataSource}
            pondId={pondId}
            connected={pond.connected}
            devices={pond.devices}
            settings={settings}
            commands={commands}
            highlightedDevice={focusedDevice}
            onOpenDetails={() => onOpenDetail("control")}
          />
        ) : (
          <div className="state-panel state-panel--warning" role="status">
            <strong>{t("settingsUnavailable", { ns: "dashboard" })}</strong>
            <p>{t("settingsRequiredForCommands", { ns: "dashboard" })}</p>
          </div>
        )}
      </div>
    </div>
  );
}

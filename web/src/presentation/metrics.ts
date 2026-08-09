import type { KeyedRecord, PondAlert, PondSensors, PondSettings, TelemetryRecord } from "../domain";

export type MetricTone = "normal" | "warning" | "critical" | "info" | "offline";
export type SensorMetricKey = keyof PondSensors;

export interface MetricViewModel {
  key: SensorMetricKey;
  label: string;
  value: string;
  unit: string;
  state: "Normal" | "Warning" | "Critical" | "Info";
  tone: MetricTone;
  safeRange: string;
  trend: number[];
}

export function createMetricViewModels(
  sensors: PondSensors,
  settings: PondSettings | null,
  alerts: Array<KeyedRecord<PondAlert>>,
  telemetry: Array<KeyedRecord<TelemetryRecord>>,
): MetricViewModel[] {
  return [
    createMetric("ph", "pH", sensors, settings, alerts, telemetry, 2, ""),
    createMetric("do", "Dissolved oxygen", sensors, settings, alerts, telemetry, 1, "mg/L"),
    createMetric("temperature", "Temperature", sensors, settings, alerts, telemetry, 1, "°C"),
    createMetric("waterLevel", "Water level", sensors, settings, alerts, telemetry, 0, "%"),
    createMetric("rain", "Rain state", sensors, settings, alerts, telemetry, 0, ""),
    createMetric("ec", "Electrical conductivity", sensors, settings, alerts, telemetry, 1, ""),
    createMetric("salinity", "Estimated salinity", sensors, settings, alerts, telemetry, 1, "ppt"),
  ];
}

function createMetric(
  key: SensorMetricKey,
  label: string,
  sensors: PondSensors,
  settings: PondSettings | null,
  alerts: Array<KeyedRecord<PondAlert>>,
  telemetry: Array<KeyedRecord<TelemetryRecord>>,
  decimals: number,
  unit: string,
): MetricViewModel {
  const rawValue = sensors[key];
  const tone = getMetricTone(key, sensors, settings, alerts);
  return {
    key,
    label,
    value: key === "rain" ? (rawValue ? "Có mưa" : "Không mưa") : (rawValue as number).toFixed(decimals),
    unit,
    state: tone === "critical" ? "Critical" : tone === "warning" ? "Warning" : tone === "info" ? "Info" : "Normal",
    tone,
    safeRange: getSafeRange(key, settings),
    trend: telemetry.map((record) => toTrendValue(record.value[key])),
  };
}

function getMetricTone(
  key: SensorMetricKey,
  sensors: PondSensors,
  settings: PondSettings | null,
  alerts: Array<KeyedRecord<PondAlert>>,
): MetricTone {
  const activeAlerts = alerts.map((alert) => alert.value).filter((alert) => alert.status === "active");
  const hasCriticalAlertForMetric = activeAlerts.some(
    (alert) => alert.severity === "critical" && alert.measurements && key in alert.measurements,
  );
  const hasWarningAlertForMetric = activeAlerts.some(
    (alert) => alert.severity === "warning" && alert.measurements && key in alert.measurements,
  );

  if (hasCriticalAlertForMetric) return "critical";
  if (hasWarningAlertForMetric) return "warning";

  if (!settings) return "info";

  if (key === "do") {
    if (sensors.do <= settings.thresholds.do.critical) return "critical";
    if (sensors.do < settings.thresholds.do.hypoxia) return "warning";
    if (sensors.do < settings.thresholds.do.normalMin) return "warning";
    return "normal";
  }

  if (key === "waterLevel") {
    if (sensors.rain && sensors.waterLevel > settings.thresholds.waterLevel.warningHigh) return "critical";
    if (
      sensors.waterLevel < settings.thresholds.waterLevel.normalMin ||
      sensors.waterLevel > settings.thresholds.waterLevel.normalMax
    ) return "warning";
    return "normal";
  }

  if (key === "temperature") {
    if (
      sensors.temperature < settings.thresholds.temperature.warningLow ||
      sensors.temperature > settings.thresholds.temperature.warningHigh
    ) return "warning";
    return "normal";
  }

  if (key === "salinity") {
    if (sensors.salinity < settings.thresholds.salinity.warningLow || sensors.salinity > settings.thresholds.salinity.warningHigh) {
      return "warning";
    }
    return "normal";
  }

  if (key === "ph") {
    if (sensors.ph < settings.thresholds.ph.warningLow || sensors.ph > settings.thresholds.ph.warningHigh) return "warning";
    return "normal";
  }

  if (key === "rain") return sensors.rain ? "info" : "normal";
  return "info";
}

function getSafeRange(key: SensorMetricKey, settings: PondSettings | null): string {
  if (!settings) return "Safe range unavailable";

  if (key === "ph") return `${settings.thresholds.ph.normalMin}-${settings.thresholds.ph.normalMax}`;
  if (key === "do") return `Normal ≥ ${settings.thresholds.do.normalMin} mg/L; recovery > ${settings.thresholds.do.recovery} mg/L`;
  if (key === "temperature") return `${settings.thresholds.temperature.normalMin}-${settings.thresholds.temperature.normalMax} °C`;
  if (key === "waterLevel") return `${settings.thresholds.waterLevel.normalMin}-${settings.thresholds.waterLevel.normalMax}%`;
  if (key === "salinity") return `${settings.thresholds.salinity.normalMin}-${settings.thresholds.salinity.normalMax} ppt`;
  if (key === "rain") return "Boolean sensor: true/false";
  return "No configured EC threshold";
}

function toTrendValue(value: number | boolean): number {
  return typeof value === "boolean" ? Number(value) : value;
}

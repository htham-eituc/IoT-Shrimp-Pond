import type { KeyedRecord, PondAlert, PondSensors, PondSettings, TelemetryRecord } from "../domain";
import type { TFunction } from "i18next";
import { formatNumber } from "../i18n/formatters";
import { getActiveLocale } from "../i18n";

export type MetricTone = "normal" | "warning" | "critical" | "info" | "offline";
export type SensorMetricKey = keyof PondSensors;
export type PrimaryMetricKey = Exclude<SensorMetricKey, "ec">;

export interface MetricViewModel {
  key: SensorMetricKey;
  label: string;
  value: string;
  unit: string;
  state: string;
  tone: MetricTone;
  safeRange: string;
  trend: number[];
}

export type PrimaryMetricViewModel = MetricViewModel & { key: PrimaryMetricKey };

export function createMetricViewModels(
  sensors: PondSensors,
  settings: PondSettings | null,
  alerts: Array<KeyedRecord<PondAlert>>,
  telemetry: Array<KeyedRecord<TelemetryRecord>>,
  t: TFunction,
  language: string,
): MetricViewModel[] {
  const locale = getActiveLocale(language);
  return [
    createMetric("ph", sensors, settings, alerts, telemetry, 2, "", t, locale),
    createMetric("do", sensors, settings, alerts, telemetry, 1, "mg/L", t, locale),
    createMetric("temperature", sensors, settings, alerts, telemetry, 1, "°C", t, locale),
    createMetric("waterLevel", sensors, settings, alerts, telemetry, 0, "%", t, locale),
    createMetric("rain", sensors, settings, alerts, telemetry, 0, "", t, locale),
    createMetric("ec", sensors, settings, alerts, telemetry, 1, "", t, locale),
    createMetric("salinity", sensors, settings, alerts, telemetry, 1, "ppt", t, locale),
  ];
}

export function createPrimaryMetricViewModels(
  metrics: readonly MetricViewModel[],
): PrimaryMetricViewModel[] {
  return metrics.filter((metric): metric is PrimaryMetricViewModel => metric.key !== "ec");
}

export function getPrimaryMetricKeyForSensor(sensor: SensorMetricKey): PrimaryMetricKey {
  return sensor === "ec" ? "salinity" : sensor;
}

export function metricSeverity(tone: MetricTone): number {
  if (tone === "critical") return 4;
  if (tone === "warning") return 3;
  if (tone === "normal") return 2;
  if (tone === "info") return 1;
  return 0;
}

function createMetric(
  key: SensorMetricKey,
  sensors: PondSensors,
  settings: PondSettings | null,
  alerts: Array<KeyedRecord<PondAlert>>,
  telemetry: Array<KeyedRecord<TelemetryRecord>>,
  decimals: number,
  unit: string,
  t: TFunction,
  locale: ReturnType<typeof getActiveLocale>,
): MetricViewModel {
  const rawValue = sensors[key];
  const tone = getMetricTone(key, sensors, settings, alerts);
  return {
    key,
    label: t(`${key}.label`, { ns: "sensors" }),
    value: key === "rain"
      ? t(rawValue ? "rain.yes" : "rain.no", { ns: "sensors" })
      : formatNumber(rawValue as number, locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    unit,
    state: t(`status.${tone}`, { ns: "common" }),
    tone,
    safeRange: getSafeRange(key, settings, t, locale),
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
    (alert) => alert.severity === "critical" && alertAffectsMetric(alert, key),
  );
  const hasWarningAlertForMetric = activeAlerts.some(
    (alert) => alert.severity === "warning" && alertAffectsMetric(alert, key),
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

export function alertAffectsMetric(alert: PondAlert, key: SensorMetricKey): boolean {
  const type = alert.type.toLowerCase().replaceAll("_", "-");
  if (type === "hypoxia" || type.endsWith("-do")) return key === "do";
  if (type === "rain-overflow") return key === "rain" || key === "waterLevel";
  if (type.includes("water-level")) return key === "waterLevel";
  if (type === "heat-salinity") return key === "temperature" || key === "salinity";
  if (type.includes("temperature")) return key === "temperature";
  if (type.endsWith("-ph")) return key === "ph";
  const measuredKeys = Object.keys(alert.measurements ?? {});
  return measuredKeys.length === 1 && measuredKeys[0] === key;
}

function getSafeRange(
  key: SensorMetricKey,
  settings: PondSettings | null,
  t: TFunction,
  locale: ReturnType<typeof getActiveLocale>,
): string {
  if (!settings) return t("safeRangeUnavailable", { ns: "sensors" });

  const number = (value: number) => formatNumber(value, locale, { maximumFractionDigits: 2 });

  if (key === "ph") return t("normalRange", { ns: "sensors", min: number(settings.thresholds.ph.normalMin), max: number(settings.thresholds.ph.normalMax), unit: "" });
  if (key === "do") return t("dissolvedOxygenRange", { ns: "sensors", normalMin: number(settings.thresholds.do.normalMin), recovery: number(settings.thresholds.do.recovery) });
  if (key === "temperature") return t("normalRange", { ns: "sensors", min: number(settings.thresholds.temperature.normalMin), max: number(settings.thresholds.temperature.normalMax), unit: " °C" });
  if (key === "waterLevel") return t("normalRange", { ns: "sensors", min: number(settings.thresholds.waterLevel.normalMin), max: number(settings.thresholds.waterLevel.normalMax), unit: "%" });
  if (key === "salinity") return t("normalRange", { ns: "sensors", min: number(settings.thresholds.salinity.normalMin), max: number(settings.thresholds.salinity.normalMax), unit: " ppt" });
  if (key === "rain") return t("booleanRange", { ns: "sensors" });
  return t("noEcThreshold", { ns: "sensors" });
}

function toTrendValue(value: number | boolean): number {
  return typeof value === "boolean" ? Number(value) : value;
}

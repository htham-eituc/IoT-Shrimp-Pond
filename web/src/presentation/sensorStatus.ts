import type {
  AlertRecord,
  PondSensors,
  PondSettings,
} from "../domain";

export type SensorKey = keyof PondSensors;
export type SensorTone = "normal" | "warning" | "critical" | "info";

export function getSensorTone(
  key: SensorKey,
  sensors: PondSensors,
  settings: PondSettings | null,
  alerts: readonly AlertRecord[],
): SensorTone {
  const activeAlerts = alerts.filter((alert) => alert.status === "active");
  const hasCriticalAlert = activeAlerts.some(
    (alert) =>
      alert.severity === "critical" &&
      (key in alert.measurements ||
        (alert.type === "hypoxia" && key === "do") ||
        (alert.type === "rain_overflow" && (key === "rain" || key === "waterLevel")) ||
        (alert.type === "heat_salinity" && (key === "temperature" || key === "salinity"))),
  );

  if (hasCriticalAlert) {
    return "critical";
  }

  if (key === "rain") {
    return sensors.rain ? "warning" : "normal";
  }

  if (key === "ec" || settings === null) {
    return "info";
  }

  switch (key) {
    case "do":
      if (sensors.do < settings.thresholds.do.hypoxia) return "critical";
      return sensors.do < settings.thresholds.do.normalMin ? "warning" : "normal";
    case "ph":
      return outsideRange(
        sensors.ph,
        settings.thresholds.ph.normalMin,
        settings.thresholds.ph.normalMax,
      )
        ? "warning"
        : "normal";
    case "temperature":
      return outsideRange(
        sensors.temperature,
        settings.thresholds.temperature.normalMin,
        settings.thresholds.temperature.normalMax,
      )
        ? "warning"
        : "normal";
    case "salinity":
      return outsideRange(
        sensors.salinity,
        settings.thresholds.salinity.normalMin,
        settings.thresholds.salinity.normalMax,
      )
        ? "warning"
        : "normal";
    case "waterLevel":
      if (
        sensors.rain &&
        sensors.waterLevel > settings.thresholds.waterLevel.warningHigh
      ) {
        return "critical";
      }
      return outsideRange(
        sensors.waterLevel,
        settings.thresholds.waterLevel.normalMin,
        settings.thresholds.waterLevel.normalMax,
      )
        ? "warning"
        : "normal";
  }
}

export function getSensorRangeLabel(
  key: SensorKey,
  settings: PondSettings | null,
): string {
  if (settings === null) return "Configured range unavailable";

  switch (key) {
    case "ph":
      return `Preferred ${formatRange(settings.thresholds.ph.normalMin, settings.thresholds.ph.normalMax)}`;
    case "do":
      return `Normal ≥ ${settings.thresholds.do.normalMin.toFixed(1)} mg/L`;
    case "temperature":
      return `Preferred ${formatRange(settings.thresholds.temperature.normalMin, settings.thresholds.temperature.normalMax)} °C`;
    case "waterLevel":
      return `Preferred ${formatRange(settings.thresholds.waterLevel.normalMin, settings.thresholds.waterLevel.normalMax)}%`;
    case "salinity":
      return `Preferred ${formatRange(settings.thresholds.salinity.normalMin, settings.thresholds.salinity.normalMax)} ppt`;
    case "rain":
      return "Boolean rain detection";
    case "ec":
      return "Raw conductivity reading";
  }
}

function outsideRange(value: number, minimum: number, maximum: number): boolean {
  return value < minimum || value > maximum;
}

function formatRange(minimum: number, maximum: number): string {
  return `${minimum}–${maximum}`;
}

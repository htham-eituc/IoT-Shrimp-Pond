import {
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  ALERT_TYPES,
  COMMAND_STATUSES,
  DEVICE_ACTIONS,
  DEVICE_NAMES,
  EVENT_TYPES,
  OPERATING_MODES,
  POND_STATUSES,
  USER_ROLES,
  type AlertMeasurements,
  type PondAlert,
  type PondCommand,
  type PondDevices,
  type PondEvent,
  type PondSensors,
  type PondSettings,
  type PondState,
  type PondUser,
  type TelemetrySample,
} from "./pond";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOneOf<const TValues extends readonly string[]>(
  values: TValues,
  value: unknown,
): value is TValues[number] {
  return typeof value === "string" && values.some((item) => item === value);
}

function hasOnlyKeys(value: UnknownRecord, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

export function isPondUser(value: unknown): value is PondUser {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isOneOf(USER_ROLES, value.role) &&
    typeof value.pondId === "string" &&
    value.pondId.length > 0 &&
    isOptionalString(value.displayName)
  );
}

export function isPondSensors(value: unknown): value is PondSensors {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasOnlyKeys(value, [
      "ph",
      "do",
      "temperature",
      "waterLevel",
      "rain",
      "ec",
      "salinity",
    ]) &&
    isFiniteNumber(value.ph) &&
    value.ph >= 0 &&
    value.ph <= 14 &&
    isFiniteNumber(value.do) &&
    value.do >= 0 &&
    value.do <= 30 &&
    isFiniteNumber(value.temperature) &&
    value.temperature >= 0 &&
    value.temperature <= 60 &&
    isFiniteNumber(value.waterLevel) &&
    value.waterLevel >= 0 &&
    value.waterLevel <= 100 &&
    typeof value.rain === "boolean" &&
    isNonNegativeNumber(value.ec) &&
    isFiniteNumber(value.salinity) &&
    value.salinity >= 0 &&
    value.salinity <= 60
  );
}

export function isPondDevices(value: unknown): value is PondDevices {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasOnlyKeys(value, DEVICE_NAMES) &&
    DEVICE_NAMES.every((device) => typeof value[device] === "boolean")
  );
}

export function isPondState(value: unknown): value is PondState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    value.name.length > 0 &&
    value.name.length <= 100 &&
    isOneOf(POND_STATUSES, value.status) &&
    typeof value.connected === "boolean" &&
    isNonNegativeNumber(value.lastSeenMs) &&
    isPondSensors(value.sensors) &&
    isPondDevices(value.devices)
  );
}

function isRangeThresholds(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.normalMin) &&
    isFiniteNumber(value.normalMax) &&
    isFiniteNumber(value.warningLow) &&
    isFiniteNumber(value.warningHigh)
  );
}

function isDissolvedOxygenThresholds(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.normalMin) &&
    isFiniteNumber(value.hypoxia) &&
    isFiniteNumber(value.critical) &&
    isFiniteNumber(value.recovery) &&
    isNonNegativeNumber(value.triggerDurationSec)
  );
}

function isWaterLevelThresholds(value: unknown): boolean {
  return (
    isRangeThresholds(value) &&
    isRecord(value) &&
    isNonNegativeNumber(value.overflowTriggerDurationSec)
  );
}

export function isPondSettings(value: unknown): value is PondSettings {
  if (!isRecord(value) || !isRecord(value.thresholds) || !isRecord(value.automation)) {
    return false;
  }

  return (
    isOneOf(OPERATING_MODES, value.mode) &&
    isRangeThresholds(value.thresholds.ph) &&
    isDissolvedOxygenThresholds(value.thresholds.do) &&
    isRangeThresholds(value.thresholds.temperature) &&
    isRangeThresholds(value.thresholds.salinity) &&
    isWaterLevelThresholds(value.thresholds.waterLevel) &&
    typeof value.automation.hypoxiaResponseEnabled === "boolean" &&
    typeof value.automation.rainOverflowResponseEnabled === "boolean" &&
    typeof value.automation.heatSalinityResponseEnabled === "boolean"
  );
}

export function isPondCommand(value: unknown): value is PondCommand {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isOneOf(DEVICE_NAMES, value.device) &&
    isOneOf(DEVICE_ACTIONS, value.action) &&
    value.source === "manual" &&
    isNonNegativeNumber(value.createdAtMs) &&
    isOneOf(COMMAND_STATUSES, value.status) &&
    (value.processedAtMs === null || isNonNegativeNumber(value.processedAtMs))
  );
}

export function isTelemetrySample(value: unknown): value is TelemetrySample {
  if (!isRecord(value) || !isNonNegativeNumber(value.timestampMs)) {
    return false;
  }

  return isPondSensors({
    ph: value.ph,
    do: value.do,
    temperature: value.temperature,
    waterLevel: value.waterLevel,
    rain: value.rain,
    ec: value.ec,
    salinity: value.salinity,
  });
}

function isAlertMeasurements(value: unknown): value is AlertMeasurements {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasOnlyKeys(value, ["ph", "do", "temperature", "waterLevel", "rain", "ec", "salinity"])) {
    return false;
  }

  return Object.entries(value).every(([key, measurement]) =>
    key === "rain" ? typeof measurement === "boolean" : isFiniteNumber(measurement),
  );
}

export function isPondAlert(value: unknown): value is PondAlert {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isOneOf(ALERT_TYPES, value.type) &&
    isOneOf(ALERT_SEVERITIES, value.severity) &&
    isOneOf(ALERT_STATUSES, value.status) &&
    typeof value.message === "string" &&
    isAlertMeasurements(value.measurements) &&
    isNonNegativeNumber(value.createdAtMs) &&
    (value.resolvedAtMs === null || isNonNegativeNumber(value.resolvedAtMs))
  );
}

export function isPondEvent(value: unknown): value is PondEvent {
  if (
    !isRecord(value) ||
    !isOneOf(EVENT_TYPES, value.type) ||
    !isNonNegativeNumber(value.createdAtMs) ||
    !isOptionalString(value.reason)
  ) {
    return false;
  }

  if (value.type === "device_action") {
    return (
      (value.source === "automatic" || value.source === "manual") &&
      isOneOf(DEVICE_NAMES, value.device) &&
      isOneOf(DEVICE_ACTIONS, value.action)
    );
  }

  return (
    value.source === undefined || value.source === "automatic" || value.source === "manual"
  );
}

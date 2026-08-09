import type {
  Command,
  CommandAction,
  CommandDevice,
  KeyedRecord,
  PondAlert,
  PondDevices,
  PondEvent,
  PondSensors,
  PondSettings,
  PondState,
  TelemetryRecord,
  UserProfile,
} from "../domain";

const COMMAND_DEVICES: CommandDevice[] = [
  "aerator",
  "drainagePump",
  "dilutionPump",
  "feeder",
  "buzzer",
  "warningBeacon",
];
const COMMAND_ACTIONS: CommandAction[] = ["on", "off"];

export function parseUserProfile(value: unknown, path = "user profile"): UserProfile {
  const record = readObject(value, path);
  return {
    role: readEnum(record.role, ["farmer", "device"], `${path}.role`),
    pondId: readNonEmptyString(record.pondId, `${path}.pondId`),
    displayName: readNonEmptyString(record.displayName, `${path}.displayName`),
  };
}

export function parsePondState(value: unknown, path = "pond"): PondState {
  const record = readObject(value, path);
  return {
    name: readNonEmptyString(record.name, `${path}.name`),
    status: readEnum(record.status, ["normal", "warning", "critical"], `${path}.status`),
    connected: readBoolean(record.connected, `${path}.connected`),
    lastSeenMs: readNumber(record.lastSeenMs, `${path}.lastSeenMs`, 0),
    sensors: parsePondSensors(record.sensors, `${path}.sensors`),
    devices: parsePondDevices(record.devices, `${path}.devices`),
  };
}

export function parsePondSettings(value: unknown, path = "settings"): PondSettings {
  const record = readObject(value, path);
  const thresholds = readObject(record.thresholds, `${path}.thresholds`);
  const ph = readObject(thresholds.ph, `${path}.thresholds.ph`);
  const dissolvedOxygen = readObject(thresholds.do, `${path}.thresholds.do`);
  const temperature = readObject(thresholds.temperature, `${path}.thresholds.temperature`);
  const salinity = readObject(thresholds.salinity, `${path}.thresholds.salinity`);
  const waterLevel = readObject(thresholds.waterLevel, `${path}.thresholds.waterLevel`);
  const automation = readObject(record.automation, `${path}.automation`);

  return {
    mode: readEnum(record.mode, ["automatic", "manual"], `${path}.mode`),
    thresholds: {
      ph: parseRange(ph, `${path}.thresholds.ph`),
      do: {
        normalMin: readNumber(dissolvedOxygen.normalMin, `${path}.thresholds.do.normalMin`),
        hypoxia: readNumber(dissolvedOxygen.hypoxia, `${path}.thresholds.do.hypoxia`),
        critical: readNumber(dissolvedOxygen.critical, `${path}.thresholds.do.critical`),
        recovery: readNumber(dissolvedOxygen.recovery, `${path}.thresholds.do.recovery`),
        triggerDurationSec: readNumber(dissolvedOxygen.triggerDurationSec, `${path}.thresholds.do.triggerDurationSec`, 0),
      },
      temperature: parseRange(temperature, `${path}.thresholds.temperature`),
      salinity: parseRange(salinity, `${path}.thresholds.salinity`),
      waterLevel: {
        ...parseRange(waterLevel, `${path}.thresholds.waterLevel`),
        overflowTriggerDurationSec: readNumber(
          waterLevel.overflowTriggerDurationSec,
          `${path}.thresholds.waterLevel.overflowTriggerDurationSec`,
          0,
        ),
      },
    },
    automation: {
      hypoxiaResponseEnabled: readBoolean(automation.hypoxiaResponseEnabled, `${path}.automation.hypoxiaResponseEnabled`),
      rainOverflowResponseEnabled: readBoolean(automation.rainOverflowResponseEnabled, `${path}.automation.rainOverflowResponseEnabled`),
      heatSalinityResponseEnabled: readBoolean(automation.heatSalinityResponseEnabled, `${path}.automation.heatSalinityResponseEnabled`),
    },
  };
}

export function parseCommand(value: unknown, path = "command"): Command {
  const record = readObject(value, path);
  return {
    device: readEnum(record.device, COMMAND_DEVICES, `${path}.device`),
    action: readEnum(record.action, COMMAND_ACTIONS, `${path}.action`),
    source: readEnum(record.source, ["manual"], `${path}.source`),
    createdAtMs: readNumber(record.createdAtMs, `${path}.createdAtMs`, 0),
    status: readEnum(record.status, ["pending", "completed", "failed"], `${path}.status`),
    processedAtMs: readNullableTimestamp(record.processedAtMs, `${path}.processedAtMs`),
  };
}

export function parseTelemetryRecord(value: unknown, path = "telemetry"): TelemetryRecord {
  const record = readObject(value, path);
  return {
    timestampMs: readNumber(record.timestampMs, `${path}.timestampMs`, 0),
    ...parsePondSensors(record, path),
  };
}

export function parsePondAlert(value: unknown, path = "alert"): PondAlert {
  const record = readObject(value, path);
  return {
    type: readNonEmptyString(record.type, `${path}.type`),
    severity: readEnum(record.severity, ["warning", "critical"], `${path}.severity`),
    status: readEnum(record.status, ["active", "resolved"], `${path}.status`),
    message: readNonEmptyString(record.message, `${path}.message`),
    measurements: record.measurements === undefined || record.measurements === null
      ? undefined
      : parseMeasurements(record.measurements, `${path}.measurements`),
    createdAtMs: readNumber(record.createdAtMs, `${path}.createdAtMs`, 0),
    resolvedAtMs: readNullableTimestamp(record.resolvedAtMs, `${path}.resolvedAtMs`),
  };
}

export function parsePondEvent(value: unknown, path = "event"): PondEvent {
  const record = readObject(value, path);
  return {
    type: readNonEmptyString(record.type, `${path}.type`),
    source: readOptionalString(record.source, `${path}.source`),
    device: record.device === undefined ? undefined : readEnum(record.device, COMMAND_DEVICES, `${path}.device`),
    action: record.action === undefined ? undefined : readEnum(record.action, COMMAND_ACTIONS, `${path}.action`),
    reason: readOptionalString(record.reason, `${path}.reason`),
    createdAtMs: readNumber(record.createdAtMs, `${path}.createdAtMs`, 0),
  };
}

export function parseKeyedRecordList<T>(
  value: unknown,
  parser: (item: unknown, path: string) => T,
  path: string,
): Array<KeyedRecord<T>> {
  if (value === null || value === undefined) return [];
  const record = readObject(value, path);
  return Object.entries(record).map(([id, item]) => ({
    id,
    value: parser(item, `${path}.${id}`),
  }));
}

function parsePondSensors(value: unknown, path: string): PondSensors {
  const record = readObject(value, path);
  return {
    ph: readNumber(record.ph, `${path}.ph`, 0, 14),
    do: readNumber(record.do, `${path}.do`, 0, 30),
    temperature: readNumber(record.temperature, `${path}.temperature`, 0, 60),
    waterLevel: readNumber(record.waterLevel, `${path}.waterLevel`, 0, 100),
    rain: readBoolean(record.rain, `${path}.rain`),
    ec: readNumber(record.ec, `${path}.ec`, 0),
    salinity: readNumber(record.salinity, `${path}.salinity`, 0, 60),
  };
}

function parsePondDevices(value: unknown, path: string): PondDevices {
  const record = readObject(value, path);
  return {
    aerator: readBoolean(record.aerator, `${path}.aerator`),
    drainagePump: readBoolean(record.drainagePump, `${path}.drainagePump`),
    dilutionPump: readBoolean(record.dilutionPump, `${path}.dilutionPump`),
    feeder: readBoolean(record.feeder, `${path}.feeder`),
    buzzer: readBoolean(record.buzzer, `${path}.buzzer`),
    warningBeacon: readBoolean(record.warningBeacon, `${path}.warningBeacon`),
  };
}

function parseMeasurements(value: unknown, path: string): Partial<PondSensors> {
  const record = readObject(value, path);
  const measurements: Partial<PondSensors> = {};
  const numericFields = ["ph", "do", "temperature", "waterLevel", "ec", "salinity"] as const;
  for (const field of numericFields) {
    if (record[field] !== undefined) measurements[field] = readNumber(record[field], `${path}.${field}`);
  }
  if (record.rain !== undefined) measurements.rain = readBoolean(record.rain, `${path}.rain`);
  return measurements;
}

function parseRange(record: Record<string, unknown>, path: string) {
  return {
    normalMin: readNumber(record.normalMin, `${path}.normalMin`),
    normalMax: readNumber(record.normalMax, `${path}.normalMax`),
    warningLow: readNumber(record.warningLow, `${path}.warningLow`),
    warningHigh: readNumber(record.warningHigh, `${path}.warningHigh`),
  };
}

function readObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function readNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string.`);
  }
  return value;
}

function readOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return readNonEmptyString(value, path);
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean.`);
  return value;
}

function readNumber(value: unknown, path: string, minimum?: number, maximum?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${path} must be a finite number.`);
  if (minimum !== undefined && value < minimum) throw new Error(`${path} must be at least ${minimum}.`);
  if (maximum !== undefined && value > maximum) throw new Error(`${path} must be at most ${maximum}.`);
  return value;
}

function readNullableTimestamp(value: unknown, path: string): number | null {
  if (value === undefined || value === null) return null;
  return readNumber(value, path, 0);
}

function readEnum<const T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${path} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

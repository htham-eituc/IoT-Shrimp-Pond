export type UserId = string;
export type PondId = string;
export type CommandId = string;
export type AlertId = string;
export type EventId = string;
export type TelemetryId = string;

export const USER_ROLES = ["farmer", "device"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface PondUser {
  readonly role: UserRole;
  readonly pondId: PondId;
  readonly displayName?: string;
}

export type FarmerPondUser = PondUser & { role: "farmer" };
export type DevicePondUser = PondUser & { role: "device" };

export const POND_STATUSES = ["normal", "warning", "critical"] as const;
export type PondStatus = (typeof POND_STATUSES)[number];

export interface PondSensors {
  readonly ph: number;
  readonly do: number;
  readonly temperature: number;
  readonly waterLevel: number;
  readonly rain: boolean;
  readonly ec: number;
  readonly salinity: number;
}

export const DEVICE_NAMES = [
  "aerator",
  "drainagePump",
  "dilutionPump",
  "feeder",
  "buzzer",
  "warningBeacon",
] as const;
export type DeviceName = (typeof DEVICE_NAMES)[number];

export interface PondDevices {
  readonly aerator: boolean;
  readonly drainagePump: boolean;
  readonly dilutionPump: boolean;
  readonly feeder: boolean;
  readonly buzzer: boolean;
  readonly warningBeacon: boolean;
}

export interface PondState {
  readonly name: string;
  readonly status: PondStatus;
  readonly connected: boolean;
  readonly lastSeenMs: number;
  readonly sensors: PondSensors;
  readonly devices: PondDevices;
}

export const OPERATING_MODES = ["automatic", "manual"] as const;
export type OperatingMode = (typeof OPERATING_MODES)[number];

export interface RangeThresholds {
  readonly normalMin: number;
  readonly normalMax: number;
  readonly warningLow: number;
  readonly warningHigh: number;
}

export interface DissolvedOxygenThresholds {
  readonly normalMin: number;
  readonly hypoxia: number;
  readonly critical: number;
  readonly recovery: number;
  readonly triggerDurationSec: number;
}

export interface WaterLevelThresholds extends RangeThresholds {
  readonly overflowTriggerDurationSec: number;
}

export interface PondThresholds {
  readonly ph: RangeThresholds;
  readonly do: DissolvedOxygenThresholds;
  readonly temperature: RangeThresholds;
  readonly salinity: RangeThresholds;
  readonly waterLevel: WaterLevelThresholds;
}

export interface AutomationSettings {
  readonly hypoxiaResponseEnabled: boolean;
  readonly rainOverflowResponseEnabled: boolean;
  readonly heatSalinityResponseEnabled: boolean;
}

export interface PondSettings {
  readonly mode: OperatingMode;
  readonly thresholds: PondThresholds;
  readonly automation: AutomationSettings;
}

export const DEVICE_ACTIONS = ["on", "off"] as const;
export type DeviceAction = (typeof DEVICE_ACTIONS)[number];

export const COMMAND_STATUSES = ["pending", "completed", "failed"] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

export interface PondCommand {
  readonly device: DeviceName;
  readonly action: DeviceAction;
  readonly source: "manual";
  readonly createdAtMs: number;
  readonly status: CommandStatus;
  readonly processedAtMs: number | null;
}

export interface TelemetrySample extends PondSensors {
  readonly timestampMs: number;
}

export const ALERT_TYPES = [
  "hypoxia",
  "rain_overflow",
  "heat_salinity",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITIES = ["warning", "critical"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATUSES = ["active", "resolved"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export type AlertMeasurements = Partial<PondSensors>;

export interface PondAlert {
  readonly type: AlertType;
  readonly severity: AlertSeverity;
  readonly status: AlertStatus;
  readonly message: string;
  readonly measurements: AlertMeasurements;
  readonly createdAtMs: number;
  readonly resolvedAtMs: number | null;
}

export const EVENT_TYPES = [
  "device_action",
  "mode_change",
  "threshold_change",
  "connection",
  "workflow_started",
  "workflow_resolved",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export type EventSource = "automatic" | "manual";

interface PondEventBase {
  readonly type: EventType;
  readonly createdAtMs: number;
}

export interface DeviceActionEvent extends PondEventBase {
  readonly type: "device_action";
  readonly source: EventSource;
  readonly device: DeviceName;
  readonly action: DeviceAction;
  readonly reason?: string;
}

export interface SystemEvent extends PondEventBase {
  readonly type: Exclude<EventType, "device_action">;
  readonly source?: EventSource;
  readonly reason?: string;
}

export type PondEvent = DeviceActionEvent | SystemEvent;

export type CommandRecord = PondCommand & { id: CommandId };
export type AlertRecord = PondAlert & { id: AlertId };
export type EventRecord = PondEvent & { id: EventId };
export type TelemetryRecord = TelemetrySample & { id: TelemetryId };

export interface PondDatabaseRoot {
  users: Record<UserId, PondUser>;
  ponds: Record<PondId, PondState>;
  commands: Record<PondId, Record<CommandId, PondCommand>>;
  settings: Record<PondId, PondSettings>;
  telemetry: Record<PondId, Record<TelemetryId, TelemetrySample>>;
  alerts: Record<PondId, Record<AlertId, PondAlert>>;
  events: Record<PondId, Record<EventId, PondEvent>>;
}

export interface FarmerSession {
  readonly uid: UserId;
  readonly email: string | null;
  readonly profile: FarmerPondUser;
}

export type CreateManualCommandInput = Pick<PondCommand, "device" | "action">;

export interface TelemetryQuery {
  readonly limit?: number;
  readonly startAtMs?: number;
  readonly endAtMs?: number;
}

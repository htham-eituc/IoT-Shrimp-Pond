export type UserRole = "farmer" | "device";
export type OperatingMode = "automatic" | "manual";
export type PondStatus = "normal" | "warning" | "critical";
export type CommandStatus = "pending" | "completed" | "failed";
export type CommandAction = "on" | "off";
export type CommandSource = "manual";
export type CommandDevice =
  | "aerator"
  | "drainagePump"
  | "dilutionPump"
  | "feeder"
  | "buzzer"
  | "warningBeacon";

export interface UserProfile {
  role: UserRole;
  pondId: string;
  displayName: string;
}

export interface PondSensors {
  ph: number;
  do: number;
  temperature: number;
  waterLevel: number;
  rain: boolean;
  ec: number;
  salinity: number;
}

export interface PondDevices {
  aerator: boolean;
  drainagePump: boolean;
  dilutionPump: boolean;
  feeder: boolean;
  buzzer: boolean;
  warningBeacon: boolean;
}

export interface PondState {
  name: string;
  status: PondStatus;
  connected: boolean;
  lastSeenMs: number;
  sensors: PondSensors;
  devices: PondDevices;
}

export interface PhThresholdSettings {
  normalMin: number;
  normalMax: number;
  warningLow: number;
  warningHigh: number;
}

export interface DissolvedOxygenThresholdSettings {
  normalMin: number;
  hypoxia: number;
  critical: number;
  recovery: number;
  triggerDurationSec: number;
}

export interface RangeThresholdSettings {
  normalMin: number;
  normalMax: number;
  warningLow: number;
  warningHigh: number;
}

export interface WaterLevelThresholdSettings extends RangeThresholdSettings {
  overflowTriggerDurationSec: number;
}

export interface ThresholdSettings {
  ph: PhThresholdSettings;
  do: DissolvedOxygenThresholdSettings;
  temperature: RangeThresholdSettings;
  salinity: RangeThresholdSettings;
  waterLevel: WaterLevelThresholdSettings;
}

export interface AutomationSettings {
  hypoxiaResponseEnabled: boolean;
  rainOverflowResponseEnabled: boolean;
  heatSalinityResponseEnabled: boolean;
}

export interface PondSettings {
  mode: OperatingMode;
  thresholds: ThresholdSettings;
  automation: AutomationSettings;
}

export interface Command {
  device: CommandDevice;
  action: CommandAction;
  source: CommandSource;
  createdAtMs: number;
  status: CommandStatus;
  processedAtMs: number | null;
}

export interface TelemetryRecord extends PondSensors {
  timestampMs: number;
}

export type AlertSeverity = "warning" | "critical";
export type AlertStatus = "active" | "resolved";
export type AlertType = "hypoxia" | "rain_overflow" | "heat_salinity" | string;

export interface PondAlert {
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  measurements?: Partial<PondSensors>;
  createdAtMs: number;
  resolvedAtMs: number | null;
}

export type PondEventType =
  | "device_action"
  | "mode_change"
  | "threshold_change"
  | "connection"
  | "workflow_started"
  | "workflow_resolved"
  | string;

export interface PondEvent {
  type: PondEventType;
  source?: "automatic" | "manual" | string;
  device?: CommandDevice;
  action?: CommandAction;
  reason?: string;
  createdAtMs: number;
}

export interface PondDatabaseRoot {
  users: Record<string, UserProfile>;
  ponds: Record<string, PondState>;
  settings: Record<string, PondSettings>;
  commands: Record<string, Record<string, Command>>;
  telemetry: Record<string, Record<string, TelemetryRecord>>;
  alerts: Record<string, Record<string, PondAlert>>;
  events: Record<string, Record<string, PondEvent>>;
}

export interface AuthenticatedUser {
  uid: string;
  email: string;
  profile: UserProfile;
}

export interface KeyedRecord<T> {
  id: string;
  value: T;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

import type {
  Command,
  CommandAction,
  CommandDevice,
  DeepPartial,
  KeyedRecord,
  PondAlert,
  PondEvent,
  PondSettings,
  PondState,
  TelemetryRecord,
} from "../domain";
import type { FarmerProfile } from "../domain/session";

export type Unsubscribe = () => void;
export type SubscriptionCallback<T> = (value: T) => void;
export type SubscriptionErrorCallback = (error: Error) => void;

export interface TelemetryQueryOptions {
  limit?: number;
  startAtMs?: number;
  endAtMs?: number;
}

export interface CreateCommandRequest {
  device: CommandDevice;
  action: CommandAction;
  createdAtMs?: number;
}

export interface PondAccessContext {
  profile: FarmerProfile;
}

export type SimulationScenario = "normal" | "rain_overflow" | "hypoxia" | "heat_salinity";

export interface SimulationControl {
  enabled: boolean;
  scenario: SimulationScenario;
  requestId: string;
  requestedAtMs: number;
}

export interface SimulationState {
  active: boolean;
  scenario: SimulationScenario;
  requestId: string;
  startedAtMs: number;
  updatedAtMs: number;
}

export interface SimulationSnapshot {
  control: SimulationControl | null;
  state: SimulationState | null;
}

export interface PondDataSource {
  subscribePond(pondId: string, callback: SubscriptionCallback<PondState | null>, onError?: SubscriptionErrorCallback): Unsubscribe;
  subscribeSettings(pondId: string, callback: SubscriptionCallback<PondSettings | null>, onError?: SubscriptionErrorCallback): Unsubscribe;
  subscribeAlerts(pondId: string, callback: SubscriptionCallback<Array<KeyedRecord<PondAlert>>>, onError?: SubscriptionErrorCallback): Unsubscribe;
  subscribeEvents(pondId: string, callback: SubscriptionCallback<Array<KeyedRecord<PondEvent>>>, onError?: SubscriptionErrorCallback): Unsubscribe;
  subscribeCommands(pondId: string, callback: SubscriptionCallback<Array<KeyedRecord<Command>>>, onError?: SubscriptionErrorCallback): Unsubscribe;
  subscribeSimulation(pondId: string, callback: SubscriptionCallback<SimulationSnapshot>, onError?: SubscriptionErrorCallback): Unsubscribe;

  getTelemetry(pondId: string, queryOptions?: TelemetryQueryOptions): Promise<Array<KeyedRecord<TelemetryRecord>>>;

  updateSettings(pondId: string, changes: DeepPartial<PondSettings>): Promise<PondSettings>;
  updatePondName(pondId: string, name: string): Promise<void>;
  createCommand(pondId: string, command: CreateCommandRequest): Promise<KeyedRecord<Command>>;
  resolveAlert(pondId: string, alertId: string, resolvedAtMs?: number): Promise<void>;
  requestSimulation(pondId: string, scenario: Exclude<SimulationScenario, "normal"> | null): Promise<SimulationControl>;
}

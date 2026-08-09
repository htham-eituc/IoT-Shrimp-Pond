import type {
  AuthenticatedUser,
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

export type Unsubscribe = () => void;
export type SubscriptionCallback<T> = (value: T) => void;

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

export interface PondDataSource {
  signIn(email: string, password: string): Promise<AuthenticatedUser>;
  signOut(): Promise<void>;
  getCurrentUser(): AuthenticatedUser | null;

  subscribePond(pondId: string, callback: SubscriptionCallback<PondState | null>): Unsubscribe;
  subscribeSettings(pondId: string, callback: SubscriptionCallback<PondSettings | null>): Unsubscribe;
  subscribeAlerts(pondId: string, callback: SubscriptionCallback<Array<KeyedRecord<PondAlert>>>): Unsubscribe;
  subscribeEvents(pondId: string, callback: SubscriptionCallback<Array<KeyedRecord<PondEvent>>>): Unsubscribe;
  subscribeCommands(pondId: string, callback: SubscriptionCallback<Array<KeyedRecord<Command>>>): Unsubscribe;

  getTelemetry(pondId: string, queryOptions?: TelemetryQueryOptions): Promise<Array<KeyedRecord<TelemetryRecord>>>;

  updateSettings(pondId: string, changes: DeepPartial<PondSettings>): Promise<PondSettings>;
  updatePondName(pondId: string, name: string): Promise<void>;
  createCommand(pondId: string, command: CreateCommandRequest): Promise<KeyedRecord<Command>>;
}

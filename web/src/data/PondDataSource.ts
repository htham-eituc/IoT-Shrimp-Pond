import type {
  AlertRecord,
  CommandRecord,
  CreateManualCommandInput,
  EventRecord,
  FarmerSession,
  PondId,
  PondSettings,
  PondState,
  TelemetryQuery,
  TelemetryRecord,
} from "../domain";

export type Unsubscribe = () => void;
export type ValueListener<T> = (value: T) => void;
export type ErrorListener = (error: Error) => void;

export interface PondDataSource {
  getCurrentSession(): FarmerSession | null;
  observeSession(
    listener: ValueListener<FarmerSession | null>,
    onError?: ErrorListener,
  ): Unsubscribe;
  signIn(email: string, password: string): Promise<FarmerSession>;
  signOut(): Promise<void>;

  subscribePond(
    pondId: PondId,
    listener: ValueListener<PondState | null>,
    onError?: ErrorListener,
  ): Unsubscribe;
  subscribeSettings(
    pondId: PondId,
    listener: ValueListener<PondSettings | null>,
    onError?: ErrorListener,
  ): Unsubscribe;
  subscribeAlerts(
    pondId: PondId,
    listener: ValueListener<readonly AlertRecord[]>,
    onError?: ErrorListener,
  ): Unsubscribe;
  subscribeEvents(
    pondId: PondId,
    listener: ValueListener<readonly EventRecord[]>,
    onError?: ErrorListener,
  ): Unsubscribe;
  subscribeCommands(
    pondId: PondId,
    listener: ValueListener<readonly CommandRecord[]>,
    onError?: ErrorListener,
  ): Unsubscribe;
  loadTelemetry(
    pondId: PondId,
    query?: TelemetryQuery,
  ): Promise<readonly TelemetryRecord[]>;

  createManualCommand(
    pondId: PondId,
    input: CreateManualCommandInput,
  ): Promise<CommandRecord>;
  updateSettings(pondId: PondId, settings: PondSettings): Promise<void>;
  updatePondName(pondId: PondId, name: string): Promise<void>;
}

export type PondDataSourceErrorCode =
  | "authentication-required"
  | "farmer-role-required"
  | "pond-access-denied"
  | "not-found"
  | "invalid-data"
  | "configuration-error";

export class PondDataSourceError extends Error {
  readonly code: PondDataSourceErrorCode;

  constructor(code: PondDataSourceErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PondDataSourceError";
    this.code = code;
  }
}

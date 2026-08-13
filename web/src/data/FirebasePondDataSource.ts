import {
  endAt,
  get,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  runTransaction,
  set,
  update,
  startAt,
  type Database,
  type QueryConstraint,
} from "firebase/database";
import { getFirebaseClient, type FirebaseWebConfig } from "../firebase/client";
import type {
  Command,
  DeepPartial,
  KeyedRecord,
  PondAlert,
  PondEvent,
  PondSettings,
  PondState,
  TelemetryRecord,
} from "../domain";
import type {
  CreateCommandRequest,
  PondDataSource,
  SubscriptionCallback,
  SubscriptionErrorCallback,
  PondAccessContext,
  SimulationControl,
  SimulationScenario,
  SimulationSnapshot,
  TelemetryQueryOptions,
  Unsubscribe,
} from "./PondDataSource";
import {
  parseCommand,
  parseKeyedRecordList,
  parsePondAlert,
  parsePondEvent,
  parsePondSettings,
  parsePondState,
  parseTelemetryRecord,
} from "./firebaseMappers";

export class FirebasePondDataSource implements PondDataSource {
  private readonly database: Database;

  constructor(config: FirebaseWebConfig, private readonly access: PondAccessContext) {
    this.database = getFirebaseClient(config).database;
  }

  subscribePond(
    pondId: string,
    callback: SubscriptionCallback<PondState | null>,
    onError?: SubscriptionErrorCallback,
  ): Unsubscribe {
    this.assertFarmerForPond(pondId);
    return onValue(
      ref(this.database, `ponds/${pondId}`),
      (snapshot) => deliver(() => snapshot.exists() ? parsePondState(snapshot.val(), `ponds/${pondId}`) : null, callback, onError),
      (error) => onError?.(toError(error)),
    );
  }

  subscribeSettings(
    pondId: string,
    callback: SubscriptionCallback<PondSettings | null>,
    onError?: SubscriptionErrorCallback,
  ): Unsubscribe {
    this.assertFarmerForPond(pondId);
    return onValue(
      ref(this.database, `settings/${pondId}`),
      (snapshot) => deliver(() => snapshot.exists() ? parsePondSettings(snapshot.val(), `settings/${pondId}`) : null, callback, onError),
      (error) => onError?.(toError(error)),
    );
  }

  subscribeAlerts(
    pondId: string,
    callback: SubscriptionCallback<Array<KeyedRecord<PondAlert>>>,
    onError?: SubscriptionErrorCallback,
  ): Unsubscribe {
    this.assertFarmerForPond(pondId);
    return onValue(
      ref(this.database, `alerts/${pondId}`),
      (snapshot) => deliver(
        () => parseKeyedRecordList(snapshot.val(), parsePondAlert, `alerts/${pondId}`),
        callback,
        onError,
      ),
      (error) => onError?.(toError(error)),
    );
  }

  subscribeEvents(
    pondId: string,
    callback: SubscriptionCallback<Array<KeyedRecord<PondEvent>>>,
    onError?: SubscriptionErrorCallback,
  ): Unsubscribe {
    this.assertFarmerForPond(pondId);
    return onValue(
      ref(this.database, `events/${pondId}`),
      (snapshot) => deliver(
        () => parseKeyedRecordList(snapshot.val(), parsePondEvent, `events/${pondId}`),
        callback,
        onError,
      ),
      (error) => onError?.(toError(error)),
    );
  }

  subscribeCommands(
    pondId: string,
    callback: SubscriptionCallback<Array<KeyedRecord<Command>>>,
    onError?: SubscriptionErrorCallback,
  ): Unsubscribe {
    this.assertFarmerForPond(pondId);
    return onValue(
      ref(this.database, `commands/${pondId}`),
      (snapshot) => deliver(
        () => parseKeyedRecordList(snapshot.val(), parseCommand, `commands/${pondId}`),
        callback,
        onError,
      ),
      (error) => onError?.(toError(error)),
    );
  }

  async getTelemetry(
    pondId: string,
    queryOptions: TelemetryQueryOptions = {},
  ): Promise<Array<KeyedRecord<TelemetryRecord>>> {
    this.assertFarmerForPond(pondId);
    const constraints: QueryConstraint[] = [orderByChild("timestampMs")];
    if (queryOptions.startAtMs !== undefined) constraints.push(startAt(queryOptions.startAtMs));
    if (queryOptions.endAtMs !== undefined) constraints.push(endAt(queryOptions.endAtMs));
    if (queryOptions.limit !== undefined) {
      if (!Number.isInteger(queryOptions.limit) || queryOptions.limit <= 0) {
        throw new Error("Telemetry limit must be a positive integer.");
      }
      constraints.push(limitToLast(queryOptions.limit));
    }

    const snapshot = await get(query(ref(this.database, `telemetry/${pondId}`), ...constraints));
    return parseKeyedRecordList(snapshot.val(), parseTelemetryRecord, `telemetry/${pondId}`)
      .sort((left, right) => left.value.timestampMs - right.value.timestampMs);
  }

  async updateSettings(pondId: string, changes: DeepPartial<PondSettings>): Promise<PondSettings> {
    this.assertFarmerForPond(pondId);
    const settingsRef = ref(this.database, `settings/${pondId}`);
    const result = await runTransaction(
      settingsRef,
      (currentValue) => {
        if (currentValue === null) return;
        return mergePondSettings(parsePondSettings(currentValue, `settings/${pondId}`), changes);
      },
      { applyLocally: false },
    );
    if (!result.committed || !result.snapshot.exists()) {
      throw new Error(`Settings not found for pond ${pondId}.`);
    }
    return parsePondSettings(result.snapshot.val(), `settings/${pondId}`);
  }

  async updatePondName(pondId: string, name: string): Promise<void> {
    this.assertFarmerForPond(pondId);
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      throw new Error("Pond name must be 1 to 100 characters.");
    }
    await set(ref(this.database, `ponds/${pondId}/name`), trimmedName);
  }

  async createCommand(pondId: string, request: CreateCommandRequest): Promise<KeyedRecord<Command>> {
    this.assertFarmerForPond(pondId);
    const createdAtMs = request.createdAtMs ?? Date.now();
    if (!Number.isFinite(createdAtMs) || createdAtMs < 0) {
      throw new Error("Command createdAtMs must be a nonnegative number.");
    }
    const command: Command = {
      device: request.device,
      action: request.action,
      source: "manual",
      createdAtMs,
      status: "pending",
      processedAtMs: null,
    };
    const commandRef = push(ref(this.database, `commands/${pondId}`));
    if (!commandRef.key) throw new Error("Firebase could not allocate a command ID.");
    await set(commandRef, command);
    return { id: commandRef.key, value: command };
  }

  subscribeSimulation(
    pondId: string,
    callback: SubscriptionCallback<SimulationSnapshot>,
    onError?: SubscriptionErrorCallback,
  ): Unsubscribe {
    this.assertFarmerForPond(pondId);
    return onValue(
      ref(this.database, `simulation/${pondId}`),
      (snapshot) => deliver(() => parseSimulationSnapshot(snapshot.val()), callback, onError),
      (error) => onError?.(toError(error)),
    );
  }

  async resolveAlert(pondId: string, alertId: string, resolvedAtMs = Date.now()): Promise<void> {
    this.assertFarmerForPond(pondId);
    if (!alertId || alertId.includes("/") || !Number.isFinite(resolvedAtMs) || resolvedAtMs < 0) {
      throw new Error("Invalid alert resolution request.");
    }
    await update(ref(this.database, `alerts/${pondId}/${alertId}`), {
      status: "resolved",
      resolvedAtMs,
    });
  }

  async requestSimulation(
    pondId: string,
    scenario: Exclude<SimulationScenario, "normal"> | null,
  ): Promise<SimulationControl> {
    this.assertFarmerForPond(pondId);
    const control: SimulationControl = {
      enabled: scenario !== null,
      scenario: scenario ?? "normal",
      requestId: `sim-${Date.now()}-${crypto.randomUUID()}`,
      requestedAtMs: Date.now(),
    };
    await set(ref(this.database, `simulation/${pondId}/control`), control);
    return control;
  }

  private assertFarmerForPond(pondId: string): void {
    if (this.access.profile.role !== "farmer" || this.access.profile.pondId !== pondId) {
      throw new Error(`Current user cannot access pond ${pondId}.`);
    }
  }
}

const SIMULATION_SCENARIOS: readonly SimulationScenario[] = ["normal", "rain_overflow", "hypoxia", "heat_salinity"];

function parseSimulationSnapshot(value: unknown): SimulationSnapshot {
  if (value === null || value === undefined) return { control: null, state: null };
  const root = readRecord(value, "simulation");
  return {
    control: root.control === undefined ? null : parseSimulationControl(root.control),
    state: root.state === undefined ? null : parseSimulationState(root.state),
  };
}

function parseSimulationControl(value: unknown): SimulationControl {
  const record = readRecord(value, "simulation.control");
  return {
    enabled: readBoolean(record.enabled, "simulation.control.enabled"),
    scenario: readScenario(record.scenario, "simulation.control.scenario"),
    requestId: readString(record.requestId, "simulation.control.requestId"),
    requestedAtMs: readTimestamp(record.requestedAtMs, "simulation.control.requestedAtMs"),
  };
}

function parseSimulationState(value: unknown): SimulationSnapshot["state"] {
  const record = readRecord(value, "simulation.state");
  return {
    active: readBoolean(record.active, "simulation.state.active"),
    scenario: readScenario(record.scenario, "simulation.state.scenario"),
    requestId: readString(record.requestId, "simulation.state.requestId"),
    startedAtMs: readTimestamp(record.startedAtMs, "simulation.state.startedAtMs"),
    updatedAtMs: readTimestamp(record.updatedAtMs, "simulation.state.updatedAtMs"),
  };
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean.`);
  return value;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${path} must be a non-empty string.`);
  return value;
}

function readTimestamp(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`${path} must be a nonnegative number.`);
  return value;
}

function readScenario(value: unknown, path: string): SimulationScenario {
  if (typeof value !== "string" || !SIMULATION_SCENARIOS.includes(value as SimulationScenario)) {
    throw new Error(`${path} contains an unsupported scenario.`);
  }
  return value as SimulationScenario;
}

function mergePondSettings(current: PondSettings, changes: DeepPartial<PondSettings>): PondSettings {
  return {
    mode: changes.mode ?? current.mode,
    thresholds: {
      ph: { ...current.thresholds.ph, ...changes.thresholds?.ph },
      do: { ...current.thresholds.do, ...changes.thresholds?.do },
      temperature: { ...current.thresholds.temperature, ...changes.thresholds?.temperature },
      salinity: { ...current.thresholds.salinity, ...changes.thresholds?.salinity },
      waterLevel: { ...current.thresholds.waterLevel, ...changes.thresholds?.waterLevel },
    },
    automation: { ...current.automation, ...changes.automation },
  };
}

function deliver<T>(
  readValue: () => T,
  callback: SubscriptionCallback<T>,
  onError?: SubscriptionErrorCallback,
): void {
  try {
    callback(readValue());
  } catch (error) {
    onError?.(toError(error));
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

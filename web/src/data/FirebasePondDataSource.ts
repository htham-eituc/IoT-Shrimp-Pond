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

  private assertFarmerForPond(pondId: string): void {
    if (this.access.profile.role !== "farmer" || this.access.profile.pondId !== pondId) {
      throw new Error(`Current user cannot access pond ${pondId}.`);
    }
  }
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

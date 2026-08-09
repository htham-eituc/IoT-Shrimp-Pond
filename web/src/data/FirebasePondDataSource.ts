import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  endAt,
  get,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query as firebaseQuery,
  ref,
  set,
  startAt,
  update,
  type Database,
  type Query as FirebaseQuery,
  type QueryConstraint,
} from "firebase/database";
import {
  DEVICE_ACTIONS,
  DEVICE_NAMES,
  isPondAlert,
  isPondCommand,
  isPondEvent,
  isPondSettings,
  isPondState,
  isPondUser,
  isTelemetrySample,
  type AlertRecord,
  type CommandRecord,
  type CreateManualCommandInput,
  type EventRecord,
  type FarmerPondUser,
  type FarmerSession,
  type PondAlert,
  type PondCommand,
  type PondEvent,
  type PondId,
  type PondSettings,
  type PondState,
  type TelemetryQuery,
  type TelemetryRecord,
  type TelemetrySample,
} from "../domain";
import {
  PondDataSourceError,
  type ErrorListener,
  type PondDataSource,
  type Unsubscribe,
  type ValueListener,
} from "./PondDataSource";

const DEFAULT_TELEMETRY_LIMIT = 120;
const SUBSCRIPTION_LIMIT = 100;

type UnknownRecord = Record<string, unknown>;

export interface FirebasePondDataSourceOptions {
  readonly now?: () => number;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function contractError(path: string): PondDataSourceError {
  return new PondDataSourceError(
    "invalid-data",
    `Firebase data at '${path}' does not match the pond data contract.`,
  );
}

function normalizeCommand(value: unknown): unknown {
  if (!isRecord(value) || value.processedAtMs !== undefined) {
    return value;
  }
  return { ...value, processedAtMs: null };
}

function normalizeAlert(value: unknown): unknown {
  if (!isRecord(value) || value.resolvedAtMs !== undefined) {
    return value;
  }
  return { ...value, resolvedAtMs: null };
}

function decodeNullable<T>(
  value: unknown,
  path: string,
  guard: (candidate: unknown) => candidate is T,
): T | null {
  if (value === null) {
    return null;
  }
  if (!guard(value)) {
    throw contractError(path);
  }
  return clone(value);
}

function decodeRecordMap<T>(
  value: unknown,
  path: string,
  guard: (candidate: unknown) => candidate is T,
  normalize: (candidate: unknown) => unknown = (candidate) => candidate,
): Array<{ id: string; value: T }> {
  if (value === null) {
    return [];
  }
  if (!isRecord(value)) {
    throw contractError(path);
  }

  return Object.entries(value).map(([id, rawRecord]) => {
    const normalized = normalize(rawRecord);
    if (!guard(normalized)) {
      throw contractError(`${path}/${id}`);
    }
    return { id, value: clone(normalized) };
  });
}

function decodeCommands(value: unknown, path: string): CommandRecord[] {
  return decodeRecordMap<PondCommand>(value, path, isPondCommand, normalizeCommand)
    .map(({ id, value: command }) => ({ id, ...command }))
    .sort((left, right) => right.createdAtMs - left.createdAtMs);
}

function decodeAlerts(value: unknown, path: string): AlertRecord[] {
  return decodeRecordMap<PondAlert>(value, path, isPondAlert, normalizeAlert)
    .map(({ id, value: alert }) => ({ id, ...alert }))
    .sort((left, right) => right.createdAtMs - left.createdAtMs);
}

function decodeEvents(value: unknown, path: string): EventRecord[] {
  return decodeRecordMap<PondEvent>(value, path, isPondEvent)
    .map(({ id, value: event }) => ({ id, ...event }))
    .sort((left, right) => right.createdAtMs - left.createdAtMs);
}

function decodeTelemetry(value: unknown, path: string): TelemetryRecord[] {
  return decodeRecordMap<TelemetrySample>(value, path, isTelemetrySample)
    .map(({ id, value: sample }) => ({ id, ...sample }))
    .sort((left, right) => left.timestampMs - right.timestampMs);
}

function deliverError(onError: ErrorListener | undefined, error: unknown): void {
  const normalized = asError(error);
  if (onError !== undefined) {
    onError(normalized);
    return;
  }
  throw normalized;
}

export class FirebasePondDataSource implements PondDataSource {
  private readonly now: () => number;
  private session: FarmerSession | null = null;

  constructor(
    private readonly auth: Auth,
    private readonly database: Database,
    options: FirebasePondDataSourceOptions = {},
  ) {
    this.now = options.now ?? Date.now;
  }

  getCurrentSession(): FarmerSession | null {
    return this.session === null ? null : clone(this.session);
  }

  observeSession(
    listener: ValueListener<FarmerSession | null>,
    onError?: ErrorListener,
  ): Unsubscribe {
    let active = true;
    let observationVersion = 0;

    const unsubscribe = onAuthStateChanged(
      this.auth,
      (user) => {
        observationVersion += 1;
        const version = observationVersion;
        if (user === null) {
          this.session = null;
          listener(null);
          return;
        }

        this.session = null;
        void this.loadFarmerSession(user)
          .then((session) => {
            if (!active || version !== observationVersion) {
              return;
            }
            this.session = session;
            listener(clone(session));
          })
          .catch((error: unknown) => {
            if (!active || version !== observationVersion) {
              return;
            }
            this.session = null;
            void firebaseSignOut(this.auth).catch(() => undefined);
            deliverError(onError, error);
          });
      },
      (error) => deliverError(onError, error),
    );

    return () => {
      active = false;
      observationVersion += 1;
      unsubscribe();
    };
  }

  async signIn(email: string, password: string): Promise<FarmerSession> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    try {
      const session = await this.loadFarmerSession(credential.user);
      this.session = session;
      return clone(session);
    } catch (error: unknown) {
      this.session = null;
      await firebaseSignOut(this.auth);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
    this.session = null;
  }

  subscribePond(
    pondId: PondId,
    listener: ValueListener<PondState | null>,
    onError?: ErrorListener,
  ): Unsubscribe {
    this.assertFarmerAccess(pondId);
    const path = `ponds/${pondId}`;
    return this.subscribeValue(
      ref(this.database, path),
      (value) => decodeNullable(value, path, isPondState),
      listener,
      onError,
    );
  }

  subscribeSettings(
    pondId: PondId,
    listener: ValueListener<PondSettings | null>,
    onError?: ErrorListener,
  ): Unsubscribe {
    this.assertFarmerAccess(pondId);
    const path = `settings/${pondId}`;
    return this.subscribeValue(
      ref(this.database, path),
      (value) => decodeNullable(value, path, isPondSettings),
      listener,
      onError,
    );
  }

  subscribeAlerts(
    pondId: PondId,
    listener: ValueListener<readonly AlertRecord[]>,
    onError?: ErrorListener,
  ): Unsubscribe {
    this.assertFarmerAccess(pondId);
    const path = `alerts/${pondId}`;
    const alertsQuery = firebaseQuery(
      ref(this.database, path),
      orderByChild("createdAtMs"),
      limitToLast(SUBSCRIPTION_LIMIT),
    );
    return this.subscribeValue(
      alertsQuery,
      (value) => decodeAlerts(value, path),
      listener,
      onError,
    );
  }

  subscribeEvents(
    pondId: PondId,
    listener: ValueListener<readonly EventRecord[]>,
    onError?: ErrorListener,
  ): Unsubscribe {
    this.assertFarmerAccess(pondId);
    const path = `events/${pondId}`;
    const eventsQuery = firebaseQuery(
      ref(this.database, path),
      orderByChild("createdAtMs"),
      limitToLast(SUBSCRIPTION_LIMIT),
    );
    return this.subscribeValue(
      eventsQuery,
      (value) => decodeEvents(value, path),
      listener,
      onError,
    );
  }

  subscribeCommands(
    pondId: PondId,
    listener: ValueListener<readonly CommandRecord[]>,
    onError?: ErrorListener,
  ): Unsubscribe {
    this.assertFarmerAccess(pondId);
    const path = `commands/${pondId}`;
    const commandsQuery = firebaseQuery(
      ref(this.database, path),
      orderByChild("createdAtMs"),
      limitToLast(SUBSCRIPTION_LIMIT),
    );
    return this.subscribeValue(
      commandsQuery,
      (value) => decodeCommands(value, path),
      listener,
      onError,
    );
  }

  async loadTelemetry(
    pondId: PondId,
    query: TelemetryQuery = {},
  ): Promise<readonly TelemetryRecord[]> {
    this.assertFarmerAccess(pondId);
    const limit = query.limit ?? DEFAULT_TELEMETRY_LIMIT;
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new PondDataSourceError(
        "invalid-data",
        "Telemetry limit must be a positive integer.",
      );
    }
    if (
      query.startAtMs !== undefined &&
      query.endAtMs !== undefined &&
      query.startAtMs > query.endAtMs
    ) {
      throw new PondDataSourceError(
        "invalid-data",
        "Telemetry startAtMs cannot be later than endAtMs.",
      );
    }

    const path = `telemetry/${pondId}`;
    const constraints: QueryConstraint[] = [orderByChild("timestampMs")];
    if (query.startAtMs !== undefined) {
      constraints.push(startAt(query.startAtMs));
    }
    if (query.endAtMs !== undefined) {
      constraints.push(endAt(query.endAtMs));
    }
    constraints.push(limitToLast(limit));

    const snapshot = await get(
      firebaseQuery(ref(this.database, path), ...constraints),
    );
    const value: unknown = snapshot.val();
    return decodeTelemetry(value, path);
  }

  async createManualCommand(
    pondId: PondId,
    input: CreateManualCommandInput,
  ): Promise<CommandRecord> {
    this.assertFarmerAccess(pondId);
    if (
      !DEVICE_NAMES.some((device) => device === input.device) ||
      !DEVICE_ACTIONS.some((action) => action === input.action)
    ) {
      throw new PondDataSourceError("invalid-data", "Unsupported device command.");
    }

    const command: PondCommand = {
      device: input.device,
      action: input.action,
      source: "manual",
      createdAtMs: Math.max(0, Math.trunc(this.now())),
      status: "pending",
      processedAtMs: null,
    };
    const commandRef = push(ref(this.database, `commands/${pondId}`));
    if (commandRef.key === null) {
      throw new PondDataSourceError(
        "invalid-data",
        "Firebase did not allocate a command identifier.",
      );
    }

    await set(commandRef, command);
    return { id: commandRef.key, ...command };
  }

  async updateSettings(pondId: PondId, settings: PondSettings): Promise<void> {
    this.assertFarmerAccess(pondId);
    if (!isPondSettings(settings)) {
      throw new PondDataSourceError(
        "invalid-data",
        "Settings do not match the pond settings contract.",
      );
    }

    await update(ref(this.database, `settings/${pondId}`), {
      mode: settings.mode,
      thresholds: settings.thresholds,
      automation: settings.automation,
    });
  }

  async updatePondName(pondId: PondId, name: string): Promise<void> {
    this.assertFarmerAccess(pondId);
    if (name.length === 0 || name.length > 100) {
      throw new PondDataSourceError(
        "invalid-data",
        "Pond name must contain between 1 and 100 characters.",
      );
    }
    await set(ref(this.database, `ponds/${pondId}/name`), name);
  }

  private async loadFarmerSession(user: User): Promise<FarmerSession> {
    const path = `users/${user.uid}`;
    const snapshot = await get(ref(this.database, path));
    const value: unknown = snapshot.val();
    if (!isPondUser(value)) {
      throw contractError(path);
    }
    if (value.role !== "farmer") {
      throw new PondDataSourceError(
        "farmer-role-required",
        "This dashboard requires a Firebase account with the farmer role.",
      );
    }

    return {
      uid: user.uid,
      email: user.email,
      profile: clone(value as FarmerPondUser),
    };
  }

  private assertFarmerAccess(pondId: PondId): FarmerSession {
    if (this.session === null) {
      throw new PondDataSourceError(
        "authentication-required",
        "Sign in with a farmer account before accessing pond data.",
      );
    }
    if (this.session.profile.pondId !== pondId) {
      throw new PondDataSourceError(
        "pond-access-denied",
        `The signed-in farmer cannot access pond '${pondId}'.`,
      );
    }
    return this.session;
  }

  private subscribeValue<T>(
    target: FirebaseQuery,
    decode: (value: unknown) => T,
    listener: ValueListener<T>,
    onError?: ErrorListener,
  ): Unsubscribe {
    return onValue(
      target,
      (snapshot) => {
        try {
          const value: unknown = snapshot.val();
          listener(decode(value));
        } catch (error: unknown) {
          deliverError(onError, error);
        }
      },
      (error) => deliverError(onError, error),
    );
  }
}

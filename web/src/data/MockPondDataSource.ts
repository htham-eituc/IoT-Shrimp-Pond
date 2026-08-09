import {
  DEVICE_ACTIONS,
  DEVICE_NAMES,
  isPondSettings,
  type AlertRecord,
  type CommandRecord,
  type CreateManualCommandInput,
  type EventRecord,
  type FarmerPondUser,
  type FarmerSession,
  type PondCommand,
  type PondDatabaseRoot,
  type PondId,
  type PondSettings,
  type PondState,
  type TelemetryQuery,
  type TelemetryRecord,
  type UserId,
} from "../domain";
import {
  PondDataSourceError,
  type ErrorListener,
  type PondDataSource,
  type Unsubscribe,
  type ValueListener,
} from "./PondDataSource";

export const DEFAULT_MOCK_FARMER_UID = "mock-farmer-uid";
export const DEFAULT_MOCK_DEVICE_UID = "mock-device-uid";
export const DEFAULT_MOCK_POND_ID = "pond-001";

const DEFAULT_COMMAND_PROCESSING_DELAY_MS = 700;
const DEFAULT_TELEMETRY_LIMIT = 120;

interface ListenerRegistration<T> {
  readonly listener: ValueListener<T>;
  readonly onError?: ErrorListener;
}

export interface MockPondDataSourceOptions {
  readonly initialData?: PondDatabaseRoot;
  readonly initialFarmerUid?: UserId | null;
  readonly commandProcessingDelayMs?: number;
  readonly now?: () => number;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function timestampKey(timestampMs: number): string {
  return String(Math.max(0, Math.trunc(timestampMs)));
}

export function createDefaultMockDatabase(nowMs = Date.now()): PondDatabaseRoot {
  nowMs = Math.max(30 * 60_000, Math.trunc(nowMs));
  const normalAt = nowMs - 30 * 60_000;
  const warningAt = nowMs - 20 * 60_000;
  const criticalAt = nowMs - 10 * 60_000;
  const recoveringAt = nowMs - 5 * 60_000;

  return {
    users: {
      [DEFAULT_MOCK_FARMER_UID]: {
        role: "farmer",
        pondId: DEFAULT_MOCK_POND_ID,
        displayName: "Pond Operator",
      },
      [DEFAULT_MOCK_DEVICE_UID]: {
        role: "device",
        pondId: DEFAULT_MOCK_POND_ID,
        displayName: "Pond Controller",
      },
    },
    ponds: {
      [DEFAULT_MOCK_POND_ID]: {
        name: "Smart Shrimp Pond 001",
        status: "warning",
        connected: true,
        lastSeenMs: nowMs,
        sensors: {
          ph: 7.7,
          do: 5.2,
          temperature: 33.4,
          waterLevel: 74,
          rain: false,
          ec: 27.8,
          salinity: 30.8,
        },
        devices: {
          aerator: false,
          drainagePump: false,
          dilutionPump: true,
          feeder: false,
          buzzer: false,
          warningBeacon: false,
        },
      },
    },
    settings: {
      [DEFAULT_MOCK_POND_ID]: {
        mode: "automatic",
        thresholds: {
          ph: {
            normalMin: 7.5,
            normalMax: 8.5,
            warningLow: 7.5,
            warningHigh: 8.8,
          },
          do: {
            normalMin: 5,
            hypoxia: 4,
            critical: 3.5,
            recovery: 5.5,
            triggerDurationSec: 30,
          },
          temperature: {
            normalMin: 28,
            normalMax: 32,
            warningLow: 25,
            warningHigh: 33,
          },
          salinity: {
            normalMin: 10,
            normalMax: 25,
            warningLow: 5,
            warningHigh: 30,
          },
          waterLevel: {
            normalMin: 40,
            normalMax: 80,
            warningLow: 30,
            warningHigh: 90,
            overflowTriggerDurationSec: 10,
          },
        },
        automation: {
          hypoxiaResponseEnabled: true,
          rainOverflowResponseEnabled: true,
          heatSalinityResponseEnabled: true,
        },
      },
    },
    commands: {
      [DEFAULT_MOCK_POND_ID]: {
        "mock-command-seed": {
          device: "dilutionPump",
          action: "on",
          source: "manual",
          createdAtMs: recoveringAt - 2_000,
          status: "completed",
          processedAtMs: recoveringAt - 1_300,
        },
      },
    },
    telemetry: {
      [DEFAULT_MOCK_POND_ID]: {
        [timestampKey(normalAt)]: {
          timestampMs: normalAt,
          ph: 7.9,
          do: 5.8,
          temperature: 30.1,
          waterLevel: 67,
          rain: false,
          ec: 18.2,
          salinity: 20.2,
        },
        [timestampKey(warningAt)]: {
          timestampMs: warningAt,
          ph: 7.4,
          do: 4.5,
          temperature: 32.7,
          waterLevel: 84,
          rain: true,
          ec: 22.4,
          salinity: 26.1,
        },
        [timestampKey(criticalAt)]: {
          timestampMs: criticalAt,
          ph: 7.2,
          do: 3.4,
          temperature: 34.2,
          waterLevel: 94,
          rain: true,
          ec: 31.2,
          salinity: 32.1,
        },
        [timestampKey(recoveringAt)]: {
          timestampMs: recoveringAt,
          ph: 7.6,
          do: 5.1,
          temperature: 33.7,
          waterLevel: 78,
          rain: false,
          ec: 28.6,
          salinity: 31.3,
        },
        [timestampKey(nowMs)]: {
          timestampMs: nowMs,
          ph: 7.7,
          do: 5.2,
          temperature: 33.4,
          waterLevel: 74,
          rain: false,
          ec: 27.8,
          salinity: 30.8,
        },
      },
    },
    alerts: {
      [DEFAULT_MOCK_POND_ID]: {
        "mock-alert-hypoxia": {
          type: "hypoxia",
          severity: "critical",
          status: "resolved",
          message: "DO remained below 4.0 mg/L for 30 seconds.",
          measurements: { do: 3.4 },
          createdAtMs: criticalAt,
          resolvedAtMs: recoveringAt,
        },
        "mock-alert-overflow": {
          type: "rain_overflow",
          severity: "critical",
          status: "resolved",
          message: "Water level exceeded 90% during rainfall.",
          measurements: { rain: true, waterLevel: 94, ph: 7.2 },
          createdAtMs: criticalAt + 1_000,
          resolvedAtMs: recoveringAt,
        },
        "mock-alert-heat": {
          type: "heat_salinity",
          severity: "warning",
          status: "active",
          message: "Temperature and salinity exceeded configured limits.",
          measurements: { temperature: 33.4, salinity: 30.8 },
          createdAtMs: recoveringAt,
          resolvedAtMs: null,
        },
      },
    },
    events: {
      [DEFAULT_MOCK_POND_ID]: {
        "mock-event-hypoxia": {
          type: "device_action",
          source: "automatic",
          device: "aerator",
          action: "on",
          reason: "dissolved_oxygen_low",
          createdAtMs: criticalAt + 100,
        },
        "mock-event-overflow": {
          type: "workflow_resolved",
          source: "automatic",
          reason: "rain_overflow_recovered",
          createdAtMs: recoveringAt,
        },
        "mock-event-dilution": {
          type: "device_action",
          source: "automatic",
          device: "dilutionPump",
          action: "on",
          reason: "temperature_and_salinity_high",
          createdAtMs: recoveringAt + 100,
        },
      },
    },
  };
}

export class MockPondDataSource implements PondDataSource {
  private readonly now: () => number;
  private readonly commandProcessingDelayMs: number;
  private readonly sessionListeners = new Set<ListenerRegistration<FarmerSession | null>>();
  private readonly pondListeners = new Map<
    PondId,
    Set<ListenerRegistration<PondState | null>>
  >();
  private readonly settingsListeners = new Map<
    PondId,
    Set<ListenerRegistration<PondSettings | null>>
  >();
  private readonly alertListeners = new Map<
    PondId,
    Set<ListenerRegistration<readonly AlertRecord[]>>
  >();
  private readonly eventListeners = new Map<
    PondId,
    Set<ListenerRegistration<readonly EventRecord[]>>
  >();
  private readonly commandListeners = new Map<
    PondId,
    Set<ListenerRegistration<readonly CommandRecord[]>>
  >();
  private readonly processingTimers = new Set<ReturnType<typeof setTimeout>>();
  private database: PondDatabaseRoot;
  private session: FarmerSession | null;
  private idSequence = 0;

  constructor(options: MockPondDataSourceOptions = {}) {
    this.now = options.now ?? Date.now;
    this.commandProcessingDelayMs = Math.max(
      0,
      options.commandProcessingDelayMs ?? DEFAULT_COMMAND_PROCESSING_DELAY_MS,
    );
    this.database = clone(options.initialData ?? createDefaultMockDatabase(this.now()));

    const initialFarmerUid =
      options.initialFarmerUid === undefined
        ? DEFAULT_MOCK_FARMER_UID
        : options.initialFarmerUid;
    this.session = this.createSession(initialFarmerUid, "farmer@example.com");
  }

  getCurrentSession(): FarmerSession | null {
    return this.session === null ? null : clone(this.session);
  }

  observeSession(
    listener: ValueListener<FarmerSession | null>,
    onError?: ErrorListener,
  ): Unsubscribe {
    const registration: ListenerRegistration<FarmerSession | null> = { listener, onError };
    this.sessionListeners.add(registration);
    listener(this.getCurrentSession());

    return () => {
      this.sessionListeners.delete(registration);
    };
  }

  async signIn(email: string, password: string): Promise<FarmerSession> {
    if (email.trim().length === 0 || password.length === 0) {
      throw new PondDataSourceError(
        "authentication-required",
        "Email and password are required.",
      );
    }

    const farmerEntry = Object.entries(this.database.users).find(
      ([, profile]) => profile.role === "farmer",
    );
    if (farmerEntry === undefined) {
      throw new PondDataSourceError(
        "farmer-role-required",
        "The mock database does not contain a farmer account.",
      );
    }

    this.session = this.createSession(farmerEntry[0], email);
    this.emitSession();
    return clone(this.session as FarmerSession);
  }

  async signOut(): Promise<void> {
    this.session = null;
    this.emitSession();
  }

  subscribePond(
    pondId: PondId,
    listener: ValueListener<PondState | null>,
    onError?: ErrorListener,
  ): Unsubscribe {
    this.assertFarmerAccess(pondId);
    return this.addKeyedListener(
      this.pondListeners,
      pondId,
      listener,
      onError,
      () => this.readPond(pondId),
    );
  }

  subscribeSettings(
    pondId: PondId,
    listener: ValueListener<PondSettings | null>,
    onError?: ErrorListener,
  ): Unsubscribe {
    this.assertFarmerAccess(pondId);
    return this.addKeyedListener(
      this.settingsListeners,
      pondId,
      listener,
      onError,
      () => this.readSettings(pondId),
    );
  }

  subscribeAlerts(
    pondId: PondId,
    listener: ValueListener<readonly AlertRecord[]>,
    onError?: ErrorListener,
  ): Unsubscribe {
    this.assertFarmerAccess(pondId);
    return this.addKeyedListener(
      this.alertListeners,
      pondId,
      listener,
      onError,
      () => this.readAlerts(pondId),
    );
  }

  subscribeEvents(
    pondId: PondId,
    listener: ValueListener<readonly EventRecord[]>,
    onError?: ErrorListener,
  ): Unsubscribe {
    this.assertFarmerAccess(pondId);
    return this.addKeyedListener(
      this.eventListeners,
      pondId,
      listener,
      onError,
      () => this.readEvents(pondId),
    );
  }

  subscribeCommands(
    pondId: PondId,
    listener: ValueListener<readonly CommandRecord[]>,
    onError?: ErrorListener,
  ): Unsubscribe {
    this.assertFarmerAccess(pondId);
    return this.addKeyedListener(
      this.commandListeners,
      pondId,
      listener,
      onError,
      () => this.readCommands(pondId),
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

    const samples = Object.entries(this.database.telemetry[pondId] ?? {})
      .map(([id, sample]) => ({ id, ...clone(sample) }))
      .filter(
        (sample) =>
          (query.startAtMs === undefined || sample.timestampMs >= query.startAtMs) &&
          (query.endAtMs === undefined || sample.timestampMs <= query.endAtMs),
      )
      .sort((left, right) => left.timestampMs - right.timestampMs);

    return samples.slice(-limit);
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
    if (this.database.ponds[pondId] === undefined) {
      throw new PondDataSourceError("not-found", `Pond '${pondId}' does not exist.`);
    }

    const createdAtMs = Math.max(0, Math.trunc(this.now()));
    const commandId = this.nextId("mock-command", createdAtMs);
    const command: PondCommand = {
      device: input.device,
      action: input.action,
      source: "manual",
      createdAtMs,
      status: "pending",
      processedAtMs: null,
    };
    const commands = this.database.commands[pondId] ?? {};
    this.database.commands[pondId] = { ...commands, [commandId]: command };
    this.emitCommands(pondId);

    const timer = setTimeout(() => {
      this.processingTimers.delete(timer);
      this.simulateDeviceCommand(pondId, commandId);
    }, this.commandProcessingDelayMs);
    this.processingTimers.add(timer);

    return { id: commandId, ...clone(command) };
  }

  async updateSettings(pondId: PondId, settings: PondSettings): Promise<void> {
    this.assertFarmerAccess(pondId);
    if (!isPondSettings(settings)) {
      throw new PondDataSourceError(
        "invalid-data",
        "Settings do not match the pond settings contract.",
      );
    }

    this.database.settings[pondId] = clone(settings);
    this.emitSettings(pondId);
  }

  async updatePondName(pondId: PondId, name: string): Promise<void> {
    this.assertFarmerAccess(pondId);
    if (name.length === 0 || name.length > 100) {
      throw new PondDataSourceError(
        "invalid-data",
        "Pond name must contain between 1 and 100 characters.",
      );
    }

    const pond = this.database.ponds[pondId];
    if (pond === undefined) {
      throw new PondDataSourceError("not-found", `Pond '${pondId}' does not exist.`);
    }
    this.database.ponds[pondId] = { ...pond, name };
    this.emitPond(pondId);
  }

  getDatabaseSnapshot(): PondDatabaseRoot {
    return clone(this.database);
  }

  dispose(): void {
    this.processingTimers.forEach((timer) => clearTimeout(timer));
    this.processingTimers.clear();
    this.sessionListeners.clear();
    this.pondListeners.clear();
    this.settingsListeners.clear();
    this.alertListeners.clear();
    this.eventListeners.clear();
    this.commandListeners.clear();
  }

  private createSession(uid: UserId | null, email: string): FarmerSession | null {
    if (uid === null) {
      return null;
    }
    const profile = this.database.users[uid];
    if (profile?.role !== "farmer") {
      throw new PondDataSourceError(
        "farmer-role-required",
        `User '${uid}' is not assigned the farmer role.`,
      );
    }

    return {
      uid,
      email,
      profile: clone(profile as FarmerPondUser),
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

  private nextId(prefix: string, timestampMs: number): string {
    this.idSequence += 1;
    return `${prefix}-${Math.trunc(timestampMs)}-${this.idSequence}`;
  }

  private addKeyedListener<T>(
    listeners: Map<PondId, Set<ListenerRegistration<T>>>,
    pondId: PondId,
    listener: ValueListener<T>,
    onError: ErrorListener | undefined,
    read: () => T,
  ): Unsubscribe {
    const registration: ListenerRegistration<T> = { listener, onError };
    const pondListeners = listeners.get(pondId) ?? new Set<ListenerRegistration<T>>();
    pondListeners.add(registration);
    listeners.set(pondId, pondListeners);
    listener(read());

    return () => {
      pondListeners.delete(registration);
      if (pondListeners.size === 0) {
        listeners.delete(pondId);
      }
    };
  }

  private emitSession(): void {
    const session = this.getCurrentSession();
    this.sessionListeners.forEach(({ listener }) => listener(session));
  }

  private emitKeyed<T>(
    listeners: Map<PondId, Set<ListenerRegistration<T>>>,
    pondId: PondId,
    read: () => T,
  ): void {
    const value = read();
    listeners.get(pondId)?.forEach(({ listener }) => listener(value));
  }

  private readPond(pondId: PondId): PondState | null {
    const pond = this.database.ponds[pondId];
    return pond === undefined ? null : clone(pond);
  }

  private readSettings(pondId: PondId): PondSettings | null {
    const settings = this.database.settings[pondId];
    return settings === undefined ? null : clone(settings);
  }

  private readAlerts(pondId: PondId): readonly AlertRecord[] {
    return Object.entries(this.database.alerts[pondId] ?? {})
      .map(([id, alert]) => ({ id, ...clone(alert) }))
      .sort((left, right) => right.createdAtMs - left.createdAtMs);
  }

  private readEvents(pondId: PondId): readonly EventRecord[] {
    return Object.entries(this.database.events[pondId] ?? {})
      .map(([id, event]) => ({ id, ...clone(event) }))
      .sort((left, right) => right.createdAtMs - left.createdAtMs);
  }

  private readCommands(pondId: PondId): readonly CommandRecord[] {
    return Object.entries(this.database.commands[pondId] ?? {})
      .map(([id, command]) => ({ id, ...clone(command) }))
      .sort((left, right) => right.createdAtMs - left.createdAtMs);
  }

  private emitPond(pondId: PondId): void {
    this.emitKeyed(this.pondListeners, pondId, () => this.readPond(pondId));
  }

  private emitSettings(pondId: PondId): void {
    this.emitKeyed(this.settingsListeners, pondId, () => this.readSettings(pondId));
  }

  private emitEvents(pondId: PondId): void {
    this.emitKeyed(this.eventListeners, pondId, () => this.readEvents(pondId));
  }

  private emitCommands(pondId: PondId): void {
    this.emitKeyed(this.commandListeners, pondId, () => this.readCommands(pondId));
  }

  private simulateDeviceCommand(pondId: PondId, commandId: string): void {
    const pond = this.database.ponds[pondId];
    const command = this.database.commands[pondId]?.[commandId];
    if (pond === undefined || command === undefined || command.status !== "pending") {
      return;
    }

    const processedAtMs = Math.max(0, Math.trunc(this.now()));
    this.database.ponds[pondId] = {
      ...pond,
      connected: true,
      lastSeenMs: processedAtMs,
      devices: {
        ...pond.devices,
        [command.device]: command.action === "on",
      },
    };

    const eventId = this.nextId("mock-event", processedAtMs);
    this.database.events[pondId] = {
      ...(this.database.events[pondId] ?? {}),
      [eventId]: {
        type: "device_action",
        source: "manual",
        device: command.device,
        action: command.action,
        createdAtMs: processedAtMs,
      },
    };
    this.database.commands[pondId] = {
      ...this.database.commands[pondId],
      [commandId]: {
        ...command,
        status: "completed",
        processedAtMs,
      },
    };

    this.emitPond(pondId);
    this.emitEvents(pondId);
    this.emitCommands(pondId);
  }
}

import type {
  AuthenticatedUser,
  Command,
  DeepPartial,
  KeyedRecord,
  PondAlert,
  PondDatabaseRoot,
  PondEvent,
  PondSettings,
  PondState,
  TelemetryRecord,
  UserProfile,
} from "../domain";
import type { CreateCommandRequest, PondDataSource, SubscriptionCallback, TelemetryQueryOptions, Unsubscribe } from "./PondDataSource";
import { createMockPondDatabase } from "./mockDatabase";

const FARMER_EMAIL = "farmer@example.com";
const FARMER_UID = "mock-farmer-uid";

type PondSubscriptionKey = "ponds" | "settings" | "alerts" | "events";

export class MockPondDataSource implements PondDataSource {
  private readonly database: PondDatabaseRoot;
  private readonly listeners = new Set<() => void>();
  private currentUser: AuthenticatedUser | null = null;
  private commandSequence = 1;

  constructor(database: PondDatabaseRoot = createMockPondDatabase(), private readonly now: () => number = () => Date.now()) {
    this.database = clone(database);
  }

  async signIn(email: string, password: string): Promise<AuthenticatedUser> {
    if (email.trim().toLowerCase() !== FARMER_EMAIL || password.trim().length === 0) {
      throw new Error("Invalid mock credentials.");
    }

    const profile = this.database.users[FARMER_UID];
    if (!profile || profile.role !== "farmer") {
      throw new Error("Mock farmer profile is unavailable.");
    }

    this.currentUser = {
      uid: FARMER_UID,
      email: FARMER_EMAIL,
      profile: clone(profile),
    };

    return clone(this.currentUser);
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
  }

  getCurrentUser(): AuthenticatedUser | null {
    return this.currentUser ? clone(this.currentUser) : null;
  }

  subscribePond(pondId: string, callback: SubscriptionCallback<PondState | null>): Unsubscribe {
    return this.subscribe("ponds", pondId, () => callback(this.snapshotPond(pondId)));
  }

  subscribeSettings(pondId: string, callback: SubscriptionCallback<PondSettings | null>): Unsubscribe {
    return this.subscribe("settings", pondId, () => callback(this.snapshotSettings(pondId)));
  }

  subscribeAlerts(pondId: string, callback: SubscriptionCallback<Array<KeyedRecord<PondAlert>>>): Unsubscribe {
    return this.subscribe("alerts", pondId, () => callback(this.snapshotRecordList(this.database.alerts[pondId] ?? {})));
  }

  subscribeEvents(pondId: string, callback: SubscriptionCallback<Array<KeyedRecord<PondEvent>>>): Unsubscribe {
    return this.subscribe("events", pondId, () => callback(this.snapshotRecordList(this.database.events[pondId] ?? {})));
  }

  async getTelemetry(pondId: string, queryOptions: TelemetryQueryOptions = {}): Promise<Array<KeyedRecord<TelemetryRecord>>> {
    this.assertFarmerForPond(pondId);
    let records = this.snapshotRecordList(this.database.telemetry[pondId] ?? {}).sort(
      (left, right) => left.value.timestampMs - right.value.timestampMs,
    );

    if (queryOptions.startAtMs !== undefined) {
      records = records.filter((record) => record.value.timestampMs >= queryOptions.startAtMs!);
    }

    if (queryOptions.endAtMs !== undefined) {
      records = records.filter((record) => record.value.timestampMs <= queryOptions.endAtMs!);
    }

    if (queryOptions.limit !== undefined) {
      records = records.slice(Math.max(0, records.length - queryOptions.limit));
    }

    return records;
  }

  async updateSettings(pondId: string, changes: DeepPartial<PondSettings>): Promise<PondSettings> {
    this.assertFarmerForPond(pondId);
    const current = this.database.settings[pondId];
    if (!current) {
      throw new Error(`Settings not found for pond ${pondId}.`);
    }

    this.database.settings[pondId] = mergePondSettings(current, changes);
    this.emit();
    return this.snapshotSettings(pondId)!;
  }

  async updatePondName(pondId: string, name: string): Promise<void> {
    this.assertFarmerForPond(pondId);
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      throw new Error("Pond name must be 1 to 100 characters.");
    }

    const pond = this.database.ponds[pondId];
    if (!pond) {
      throw new Error(`Pond ${pondId} was not found.`);
    }

    pond.name = trimmedName;
    this.emit();
  }

  async createCommand(pondId: string, request: CreateCommandRequest): Promise<KeyedRecord<Command>> {
    this.assertFarmerForPond(pondId);
    if (!this.database.commands[pondId]) {
      this.database.commands[pondId] = {};
    }

    const id = `cmd-${String(this.commandSequence).padStart(3, "0")}`;
    this.commandSequence += 1;

    const command: Command = {
      device: request.device,
      action: request.action,
      source: "manual",
      createdAtMs: request.createdAtMs ?? this.now(),
      status: "pending",
      processedAtMs: null,
    };

    this.database.commands[pondId][id] = command;
    this.emit();

    return { id, value: clone(command) };
  }

  getDatabaseSnapshot(): PondDatabaseRoot {
    return clone(this.database);
  }

  private subscribe(section: PondSubscriptionKey, pondId: string, emitCurrent: () => void): Unsubscribe {
    this.assertFarmerForPond(pondId);
    emitCurrent();

    const listener = () => {
      if (this.database[section][pondId] !== undefined) {
        emitCurrent();
      }
    };

    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private snapshotPond(pondId: string): PondState | null {
    const pond = this.database.ponds[pondId];
    return pond ? clone(pond) : null;
  }

  private snapshotSettings(pondId: string): PondSettings | null {
    const settings = this.database.settings[pondId];
    return settings ? clone(settings) : null;
  }

  private snapshotRecordList<T>(record: Record<string, T>): Array<KeyedRecord<T>> {
    return Object.entries(record).map(([id, value]) => ({ id, value: clone(value) }));
  }

  private assertFarmerForPond(pondId: string): UserProfile {
    if (!this.currentUser) {
      throw new Error("Sign in before reading pond data.");
    }

    const { profile } = this.currentUser;
    if (profile.role !== "farmer" || profile.pondId !== pondId) {
      throw new Error(`Current user cannot access pond ${pondId}.`);
    }

    return profile;
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

function clone<T>(value: T): T {
  return structuredClone(value);
}

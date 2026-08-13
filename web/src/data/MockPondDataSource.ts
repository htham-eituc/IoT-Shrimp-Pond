import type {
  Command,
  DeepPartial,
  KeyedRecord,
  PondAlert,
  PondDatabaseRoot,
  PondEvent,
  PondSettings,
  PondState,
  TelemetryRecord,
} from "../domain";
import type { CreateCommandRequest, PondAccessContext, PondDataSource, SimulationControl, SimulationScenario, SimulationSnapshot, SubscriptionCallback, TelemetryQueryOptions, Unsubscribe } from "./PondDataSource";
import { MockIoTController, type DemoScenario, type DemoScenarioState } from "./MockIoTController";
import { createMockPondDatabase } from "./mockDatabase";

type PondSubscriptionKey = "ponds" | "settings" | "alerts" | "events" | "commands";

export class MockPondDataSource implements PondDataSource {
  private readonly database: PondDatabaseRoot;
  private readonly controller: MockIoTController;
  private readonly listeners = new Set<() => void>();
  private commandSequence = 1;
  private simulation: SimulationSnapshot = {
    control: { enabled: false, scenario: "normal", requestId: "initial", requestedAtMs: 0 },
    state: { active: false, scenario: "normal", requestId: "initial", startedAtMs: 0, updatedAtMs: 0 },
  };

  constructor(
    private readonly access: PondAccessContext,
    database: PondDatabaseRoot | undefined = undefined,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.database = clone(database ?? createMockPondDatabase(now()));
    this.controller = new MockIoTController(this.database, now, () => this.emit());
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

  subscribeCommands(pondId: string, callback: SubscriptionCallback<Array<KeyedRecord<Command>>>): Unsubscribe {
    return this.subscribe("commands", pondId, () => callback(this.snapshotRecordList(this.database.commands[pondId] ?? {})));
  }

  subscribeSimulation(pondId: string, callback: SubscriptionCallback<SimulationSnapshot>): Unsubscribe {
    this.assertFarmerForPond(pondId);
    callback(clone(this.simulation));
    const listener = () => callback(clone(this.simulation));
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
    this.controller.schedulePendingCommand(pondId, id);

    return { id, value: clone(command) };
  }

  async resolveAlert(pondId: string, alertId: string, resolvedAtMs = this.now()): Promise<void> {
    this.assertFarmerForPond(pondId);
    const alert = this.database.alerts[pondId]?.[alertId];
    if (!alert) throw new Error(`Alert ${alertId} was not found.`);
    alert.status = "resolved";
    alert.resolvedAtMs = resolvedAtMs;
    this.emit();
  }

  async requestSimulation(
    pondId: string,
    scenario: Exclude<SimulationScenario, "normal"> | null,
  ): Promise<SimulationControl> {
    this.assertFarmerForPond(pondId);
    const requestedAtMs = this.now();
    const control: SimulationControl = {
      enabled: scenario !== null,
      scenario: scenario ?? "normal",
      requestId: `sim-${requestedAtMs}-${this.commandSequence++}`,
      requestedAtMs,
    };
    this.simulation.control = control;
    this.emit();
    return clone(control);
  }

  setDemoScenario(pondId: string, scenario: DemoScenario): void {
    this.assertFarmerForPond(pondId);
    this.controller.setScenario(pondId, scenario);
  }

  stopDemoScenario(): void {
    this.controller.stopScenario();
  }

  getDemoScenarioState(): DemoScenarioState {
    return this.controller.getScenarioState();
  }

  dispose(): void {
    this.controller.dispose();
    this.listeners.clear();
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

  private assertFarmerForPond(pondId: string): void {
    const { profile } = this.access;
    if (profile.role !== "farmer" || profile.pondId !== pondId) {
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

function clone<T>(value: T): T {
  return structuredClone(value);
}

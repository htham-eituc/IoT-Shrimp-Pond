import type {
  CommandDevice,
  PondAlert,
  PondDatabaseRoot,
  PondDevices,
  PondEvent,
  PondSensors,
  PondState,
  TelemetryRecord,
} from "../domain";

export type DemoScenario = "normal" | "hypoxia" | "rain_overflow" | "heat_salinity";

export interface DemoScenarioState {
  scenario: DemoScenario;
  rainIntensityMmPerHour: number;
}

interface MockIoTControllerOptions {
  commandDelayMs?: number;
  scenarioStepMs?: number;
  telemetryIntervalMs?: number;
}

export class MockIoTController {
  private readonly commandDelayMs: number;
  private readonly scenarioStepMs: number;
  private readonly telemetryIntervalMs: number;
  private scenarioTimer: ReturnType<typeof setTimeout> | null = null;
  private activeScenario: DemoScenario = "normal";
  private scenarioStep = 0;
  private rainIntensityMmPerHour = 0;
  private alertSequence = 1;
  private eventSequence = 1;
  private lastTelemetryAtMs = new Map<string, number>();
  private readonly commandTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly database: PondDatabaseRoot,
    private readonly now: () => number,
    private readonly notify: () => void,
    options: MockIoTControllerOptions = {},
  ) {
    this.commandDelayMs = options.commandDelayMs ?? 350;
    this.scenarioStepMs = options.scenarioStepMs ?? 1_000;
    this.telemetryIntervalMs = options.telemetryIntervalMs ?? 5_000;
    this.initializeTelemetryClock();
  }

  setScenario(pondId: string, scenario: DemoScenario): void {
    this.activeScenario = scenario;
    this.scenarioStep = 0;
    this.clearScenarioTimer();
    this.applyScenarioStep(pondId);
    this.scheduleScenarioStep(pondId);
  }

  stopScenario(): void {
    this.clearScenarioTimer();
  }

  getScenarioState(): DemoScenarioState {
    return {
      scenario: this.activeScenario,
      rainIntensityMmPerHour: this.rainIntensityMmPerHour,
    };
  }

  schedulePendingCommand(pondId: string, commandId: string): void {
    const timerKey = `${pondId}/${commandId}`;
    if (this.commandTimers.has(timerKey)) return;

    const timer = setTimeout(() => {
      this.commandTimers.delete(timerKey);
      this.processCommand(pondId, commandId);
    }, this.commandDelayMs);

    this.commandTimers.set(timerKey, timer);
  }

  dispose(): void {
    this.clearScenarioTimer();
    for (const timer of this.commandTimers.values()) {
      clearTimeout(timer);
    }
    this.commandTimers.clear();
  }

  private applyScenarioStep(pondId: string): void {
    const pond = this.database.ponds[pondId];
    if (!pond) return;

    const previousDevices = { ...pond.devices };
    const automaticMode = this.database.settings[pondId]?.mode !== "manual";

    if (this.activeScenario === "normal") {
      this.applyNormal(pondId, pond);
    }

    if (this.activeScenario === "hypoxia") {
      this.applyHypoxia(pondId, pond);
    }

    if (this.activeScenario === "rain_overflow") {
      this.applyRainOverflow(pondId, pond);
    }

    if (this.activeScenario === "heat_salinity") {
      this.applyHeatSalinity(pondId, pond);
    }

    if (!automaticMode) {
      pond.devices = previousDevices;
    }

    pond.connected = true;
    pond.lastSeenMs = this.now();
    this.appendDeviceEventsForChanges(pondId, previousDevices, pond.devices, this.activeScenario);
    this.maybeAppendTelemetry(pondId, pond.sensors);
    this.scenarioStep += 1;
    this.notify();
  }

  private applyNormal(pondId: string, pond: PondState): void {
    const phase = this.scenarioStep % 4;
    pond.sensors = {
      ph: round(7.78 + phase * 0.02, 2),
      do: round(5.8 + phase * 0.1, 2),
      temperature: round(29.4 + phase * 0.25, 2),
      waterLevel: 68 + phase,
      rain: false,
      ec: round(18.2 + phase * 0.12, 2),
      salinity: round(19.2 + phase * 0.35, 2),
    };
    pond.status = "normal";
    pond.devices = {
      aerator: false,
      drainagePump: false,
      dilutionPump: false,
      feeder: true,
      buzzer: false,
      warningBeacon: false,
    };
    this.rainIntensityMmPerHour = 0;
    this.resolveActiveAlerts(pondId, "normal_recovery");
  }

  private applyHypoxia(pondId: string, pond: PondState): void {
    if (this.scenarioStep === 0) {
      pond.sensors = {
        ...pond.sensors,
        do: 4.2,
        rain: false,
      };
      pond.status = "warning";
      this.appendEvent(pondId, {
        type: "workflow_started",
        source: "automatic",
        reason: "hypoxia_watch",
        createdAtMs: this.now(),
      });
      return;
    }

    pond.sensors = {
      ...pond.sensors,
      ph: 7.55,
      do: 3.6,
      temperature: 27.8,
      waterLevel: 70,
      rain: false,
      ec: 18.8,
      salinity: 20,
    };
    pond.status = "critical";
    pond.devices = {
      ...pond.devices,
      aerator: true,
      feeder: false,
      buzzer: true,
      warningBeacon: true,
    };
    this.rainIntensityMmPerHour = 0;
    this.ensureAlert(pondId, "hypoxia", {
      type: "hypoxia",
      severity: "critical",
      status: "active",
      message: "DO remained below 4.0 mg/L during the hypoxia scenario.",
      measurements: {
        do: pond.sensors.do,
      },
      createdAtMs: this.now(),
      resolvedAtMs: null,
    });
  }

  private applyRainOverflow(pondId: string, pond: PondState): void {
    const waterLevel = Math.min(96, 92 + this.scenarioStep * 2);
    pond.sensors = {
      ...pond.sensors,
      ph: Math.max(7.1, 7.4 - this.scenarioStep * 0.08),
      do: 5.6,
      temperature: 26.8,
      waterLevel,
      rain: true,
      ec: 16.8,
      salinity: 17.5,
    };
    pond.status = waterLevel > 90 ? "critical" : "warning";
    pond.devices = {
      ...pond.devices,
      aerator: true,
      drainagePump: waterLevel > 90,
    };
    this.rainIntensityMmPerHour = 28;
    this.ensureAlert(pondId, "rain_overflow", {
      type: "rain_overflow",
      severity: "critical",
      status: "active",
      message: "Water level exceeded 90% during rainfall.",
      measurements: {
        rain: true,
        waterLevel: pond.sensors.waterLevel,
        ph: pond.sensors.ph,
      },
      createdAtMs: this.now(),
      resolvedAtMs: null,
    });
  }

  private applyHeatSalinity(pondId: string, pond: PondState): void {
    pond.sensors = {
      ...pond.sensors,
      ph: 7.65,
      do: 5.1,
      temperature: 34.2,
      waterLevel: 72,
      rain: false,
      ec: 27.5,
      salinity: 31.2,
    };
    pond.status = "warning";
    pond.devices = {
      ...pond.devices,
      dilutionPump: true,
      feeder: false,
    };
    this.rainIntensityMmPerHour = 0;
    this.ensureAlert(pondId, "heat_salinity", {
      type: "heat_salinity",
      severity: "warning",
      status: "active",
      message: "Temperature and salinity exceeded configured limits.",
      measurements: {
        temperature: pond.sensors.temperature,
        salinity: pond.sensors.salinity,
      },
      createdAtMs: this.now(),
      resolvedAtMs: null,
    });
  }

  private scheduleScenarioStep(pondId: string): void {
    this.scenarioTimer = setTimeout(() => {
      this.applyScenarioStep(pondId);
      this.scheduleScenarioStep(pondId);
    }, this.scenarioStepMs);
  }

  private clearScenarioTimer(): void {
    if (!this.scenarioTimer) return;
    clearTimeout(this.scenarioTimer);
    this.scenarioTimer = null;
  }

  private processCommand(pondId: string, commandId: string): void {
    const command = this.database.commands[pondId]?.[commandId];
    const pond = this.database.ponds[pondId];
    if (!command || !pond || command.status !== "pending") return;

    pond.devices[command.device] = command.action === "on";
    pond.lastSeenMs = this.now();
    command.status = "completed";
    command.processedAtMs = this.now();
    this.appendEvent(pondId, {
      type: "device_action",
      source: "manual",
      device: command.device,
      action: command.action,
      reason: `manual_command:${commandId}`,
      createdAtMs: this.now(),
    });
    this.notify();
  }

  private ensureAlert(pondId: string, alertType: PondAlert["type"], alert: PondAlert): void {
    if (!this.database.alerts[pondId]) {
      this.database.alerts[pondId] = {};
    }

    const existing = Object.values(this.database.alerts[pondId]).find(
      (candidate) => candidate.type === alertType && candidate.status === "active",
    );
    if (existing) {
      existing.measurements = alert.measurements;
      existing.message = alert.message;
      return;
    }

    const id = `alert-${String(this.alertSequence).padStart(3, "0")}`;
    this.alertSequence += 1;
    this.database.alerts[pondId][id] = alert;
    this.appendEvent(pondId, {
      type: "workflow_started",
      source: "automatic",
      reason: alertType,
      createdAtMs: alert.createdAtMs,
    });
  }

  private resolveActiveAlerts(pondId: string, reason: string): void {
    const alerts = this.database.alerts[pondId] ?? {};
    let resolvedAny = false;

    for (const alert of Object.values(alerts)) {
      if (alert.status === "active") {
        alert.status = "resolved";
        alert.resolvedAtMs = this.now();
        resolvedAny = true;
      }
    }

    if (resolvedAny) {
      this.appendEvent(pondId, {
        type: "workflow_resolved",
        source: "automatic",
        reason,
        createdAtMs: this.now(),
      });
    }
  }

  private appendDeviceEventsForChanges(
    pondId: string,
    before: PondDevices,
    after: PondDevices,
    reason: string,
  ): void {
    for (const device of Object.keys(after) as CommandDevice[]) {
      if (before[device] === after[device]) continue;
      this.appendEvent(pondId, {
        type: "device_action",
        source: "automatic",
        device,
        action: after[device] ? "on" : "off",
        reason,
        createdAtMs: this.now(),
      });
    }
  }

  private appendEvent(pondId: string, event: PondEvent): void {
    if (!this.database.events[pondId]) {
      this.database.events[pondId] = {};
    }

    const id = `event-${String(this.eventSequence).padStart(3, "0")}`;
    this.eventSequence += 1;
    this.database.events[pondId][id] = event;
  }

  private maybeAppendTelemetry(pondId: string, sensors: PondSensors): void {
    const timestampMs = this.now();
    const lastTelemetryAtMs = this.lastTelemetryAtMs.get(pondId) ?? 0;
    if (timestampMs - lastTelemetryAtMs < this.telemetryIntervalMs) return;

    if (!this.database.telemetry[pondId]) {
      this.database.telemetry[pondId] = {};
    }

    const record: TelemetryRecord = {
      timestampMs,
      ...sensors,
    };
    this.database.telemetry[pondId][String(timestampMs)] = record;
    this.lastTelemetryAtMs.set(pondId, timestampMs);
  }

  private initializeTelemetryClock(): void {
    for (const [pondId, records] of Object.entries(this.database.telemetry)) {
      const latest = Math.max(0, ...Object.values(records).map((record) => record.timestampMs));
      this.lastTelemetryAtMs.set(pondId, latest);
    }
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

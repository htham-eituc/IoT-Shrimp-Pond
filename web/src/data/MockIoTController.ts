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
import { SIMULATION_CONFIG } from "./simulationConfig";

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

interface EnvironmentState {
  ph: number;
  do: number;
  temperature: number;
  waterLevel: number;
  salinity: number;
  rainElapsedSec: number;
  scenarioElapsedSec: number;
  lastStepAtMs: number | null;
}

export class MockIoTController {
  private readonly commandDelayMs: number;
  private readonly scenarioStepMs: number;
  private readonly telemetryIntervalMs: number;
  private scenarioTimer: ReturnType<typeof setTimeout> | null = null;
  private scenarioPondId: string | null = null;
  private activeScenario: DemoScenario = "normal";
  private rainIntensityMmPerHour = 0;
  private alertSequence = 1;
  private eventSequence = 1;
  private readonly lastTelemetryAtMs = new Map<string, number>();
  private readonly commandTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly environments = new Map<string, EnvironmentState>();

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
    this.scenarioPondId = pondId;
    const environment = this.environmentFor(pondId);
    environment.scenarioElapsedSec = 0;
    environment.rainElapsedSec = 0;
    environment.lastStepAtMs = this.now();
    this.applyScenarioInitialConditions(environment, scenario);
    this.clearScenarioTimer();
    this.applySimulationStep(pondId);
    this.scheduleScenarioStep(pondId);
  }

  stopDemoScenario(): void {
    this.stopScenario();
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

  private applySimulationStep(pondId: string): void {
    const pond = this.database.ponds[pondId];
    if (!pond) return;

    const environment = this.environmentFor(pondId);
    const timestampMs = this.now();
    const previousDevices = { ...pond.devices };
    const deltaSec = this.consumeDeltaSec(environment, timestampMs);
    const automaticMode = this.database.settings[pondId]?.mode !== "manual";

    if (automaticMode) {
      this.applyAutomation(pondId, pond, environment);
    }

    this.evolveEnvironment(environment, pond.devices, deltaSec);
    this.publishEnvironmentToPond(pond, environment);

    if (automaticMode) {
      this.applyAutomation(pondId, pond, environment);
    }

    pond.connected = true;
    pond.lastSeenMs = timestampMs;
    this.appendDeviceEventsForChanges(pondId, previousDevices, pond.devices, this.activeScenario);
    this.maybeAppendTelemetry(pondId, pond.sensors);
    this.notify();
  }

  private evolveEnvironment(environment: EnvironmentState, devices: PondDevices, deltaSec: number): void {
    const config = SIMULATION_CONFIG;
    const forces = config.scenarioForces[this.activeScenario];
    const rainActive = this.isRaining(environment);
    environment.scenarioElapsedSec += deltaSec;
    if (rainActive) environment.rainElapsedSec += deltaSec;

    const oxygenDemand = forces.oxygenDemandPerSec + (devices.feeder ? config.actuatorEffects.feederOxygenDemandPerSec : 0);
    const aeration = devices.aerator ? config.actuatorEffects.aeratorOxygenPerSec : 0;
    const normalDrift = config.recovery.normalDriftPerSec;

    environment.do += (aeration - oxygenDemand) * deltaSec;
    environment.do += (config.normal.do - environment.do) * normalDrift * deltaSec;
    environment.ph += (config.normal.ph - environment.ph) * normalDrift * deltaSec;
    environment.temperature += forces.temperatureTrendPerSec * deltaSec;
    environment.temperature += (config.normal.temperature - environment.temperature) * (normalDrift * 0.35) * deltaSec;
    environment.waterLevel += (config.normal.waterLevel - environment.waterLevel) * (normalDrift * 0.18) * deltaSec;
    environment.salinity += (config.normal.salinity - environment.salinity) * (normalDrift * 0.18) * deltaSec;

    if (rainActive) {
      environment.waterLevel += forces.rainWaterRisePerSec * deltaSec;
      environment.ph -= forces.rainPhDropPerSec * deltaSec;
      environment.salinity -= forces.rainSalinityDropPerSec * deltaSec;
    }

    environment.waterLevel -= forces.heatWaterLossPerSec * deltaSec;
    environment.salinity += forces.heatSalinityRisePerSec * deltaSec;

    if (devices.drainagePump) {
      environment.waterLevel -= config.actuatorEffects.drainageWaterDropPerSec * deltaSec;
    }

    if (devices.dilutionPump) {
      environment.waterLevel += config.actuatorEffects.dilutionWaterRisePerSec * deltaSec;
      environment.salinity -= config.actuatorEffects.dilutionSalinityDropPerSec * deltaSec;
      environment.temperature -= config.actuatorEffects.dilutionTemperatureCoolingPerSec * deltaSec;
    }

    if (devices.aerator) {
      environment.ph += config.actuatorEffects.aeratorPhMixingPerSec * deltaSec;
    }

    this.clampEnvironment(environment);
    this.rainIntensityMmPerHour = rainActive ? 28 : 0;
  }

  private applyAutomation(pondId: string, pond: PondState, environment: EnvironmentState): void {
    const settings = this.database.settings[pondId];
    const thresholds = settings?.thresholds;
    if (!settings || !thresholds) return;

    const hypoxiaActive = environment.do < thresholds.do.hypoxia;
    const hypoxiaRecovered = environment.do >= thresholds.do.recovery;
    const rainOverflowActive = this.isRaining(environment) && environment.waterLevel > thresholds.waterLevel.warningHigh;
    const rainOverflowRecovered = environment.waterLevel <= thresholds.waterLevel.normalMax;
    const heatSalinityActive = environment.temperature > thresholds.temperature.warningHigh && environment.salinity > thresholds.salinity.warningHigh;
    const heatSalinityRecovered = environment.salinity <= thresholds.salinity.normalMax || environment.temperature <= thresholds.temperature.normalMax;

    if (settings.automation.hypoxiaResponseEnabled && hypoxiaActive) {
      pond.devices.aerator = true;
      pond.devices.feeder = false;
      pond.devices.buzzer = true;
      pond.devices.warningBeacon = true;
      this.ensureAlert(pondId, "hypoxia", {
        type: "hypoxia",
        severity: "critical",
        status: "active",
        message: "DO is below the configured hypoxia threshold; aeration response is active.",
        measurements: { do: round(environment.do, 2) },
        createdAtMs: this.now(),
        resolvedAtMs: null,
      });
    } else if (hypoxiaRecovered) {
      this.resolveActiveAlert(pondId, "hypoxia", "hypoxia_recovered");
    }

    if (settings.automation.rainOverflowResponseEnabled && rainOverflowActive) {
      pond.devices.drainagePump = true;
      pond.devices.aerator = true;
      this.ensureAlert(pondId, "rain_overflow", {
        type: "rain_overflow",
        severity: "critical",
        status: "active",
        message: "Rainfall is raising the pond above the overflow threshold; drainage response is active.",
        measurements: { rain: true, waterLevel: round(environment.waterLevel, 1), ph: round(environment.ph, 2) },
        createdAtMs: this.now(),
        resolvedAtMs: null,
      });
    } else if (rainOverflowRecovered) {
      pond.devices.drainagePump = false;
      this.resolveActiveAlert(pondId, "rain_overflow", "rain_overflow_recovered");
    }

    if (settings.automation.heatSalinityResponseEnabled && heatSalinityActive) {
      pond.devices.dilutionPump = true;
      pond.devices.feeder = false;
      this.ensureAlert(pondId, "heat_salinity", {
        type: "heat_salinity",
        severity: "warning",
        status: "active",
        message: "Temperature and salinity are above configured limits; dilution response is active.",
        measurements: { temperature: round(environment.temperature, 2), salinity: round(environment.salinity, 2) },
        createdAtMs: this.now(),
        resolvedAtMs: null,
      });
    } else if (heatSalinityRecovered) {
      pond.devices.dilutionPump = false;
      this.resolveActiveAlert(pondId, "heat_salinity", "heat_salinity_recovered");
    }

    if (hypoxiaRecovered && rainOverflowRecovered && heatSalinityRecovered && this.activeScenario === "normal") {
      pond.devices = {
        aerator: false,
        drainagePump: false,
        dilutionPump: false,
        feeder: true,
        buzzer: false,
        warningBeacon: false,
      };
      this.resolveAllActiveAlerts(pondId, "normal_recovery");
    } else {
      if (hypoxiaRecovered && !heatSalinityActive) {
        pond.devices.buzzer = false;
        pond.devices.warningBeacon = false;
      }
      if (!hypoxiaActive && !heatSalinityActive) {
        pond.devices.feeder = true;
      }
    }
  }

  private publishEnvironmentToPond(pond: PondState, environment: EnvironmentState): void {
    const hypoxiaActive = environment.do < 4;
    const rainOverflowActive = this.isRaining(environment) && environment.waterLevel > 90;
    const heatSalinityActive = environment.temperature > 33 && environment.salinity > 30;
    const warningActive = environment.do < 5
      || environment.waterLevel > 80
      || environment.temperature > 32
      || environment.salinity > 25
      || environment.ph < 7.5
      || environment.ph > 8.5;

    pond.sensors = {
      ph: round(environment.ph, 2),
      do: round(environment.do, 2),
      temperature: round(environment.temperature, 2),
      waterLevel: round(environment.waterLevel, 1),
      rain: this.isRaining(environment),
      ec: round(environment.salinity * SIMULATION_CONFIG.telemetry.salinityToEcMultiplier + SIMULATION_CONFIG.telemetry.salinityToEcOffset, 2),
      salinity: round(environment.salinity, 2),
    };
    pond.status = hypoxiaActive || rainOverflowActive ? "critical" : heatSalinityActive || warningActive ? "warning" : "normal";
  }

  private applyScenarioInitialConditions(environment: EnvironmentState, scenario: DemoScenario): void {
    if (scenario === "normal") return;
    const initial = SIMULATION_CONFIG.initialConditions[scenario];
    environment.ph = initial.ph;
    environment.do = initial.do;
    environment.temperature = initial.temperature;
    environment.waterLevel = initial.waterLevel;
    environment.salinity = initial.salinity;
  }

  private isRaining(environment: EnvironmentState): boolean {
    return this.activeScenario === "rain_overflow" && environment.rainElapsedSec < SIMULATION_CONFIG.recovery.rainStopAfterSec;
  }

  private scheduleScenarioStep(pondId: string): void {
    this.scenarioTimer = setTimeout(() => {
      this.applySimulationStep(pondId);
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
    this.ensureScenarioRunning(pondId);
    this.notify();
  }

  private ensureScenarioRunning(pondId: string): void {
    if (this.scenarioTimer !== null && this.scenarioPondId === pondId) return;
    this.scenarioPondId = pondId;
    this.environmentFor(pondId).lastStepAtMs = this.now();
    this.scheduleScenarioStep(pondId);
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

  private resolveActiveAlert(pondId: string, alertType: PondAlert["type"], reason: string): void {
    const alerts = this.database.alerts[pondId] ?? {};
    let resolvedAny = false;

    for (const alert of Object.values(alerts)) {
      if (alert.type === alertType && alert.status === "active") {
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

  private resolveAllActiveAlerts(pondId: string, reason: string): void {
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

  private environmentFor(pondId: string): EnvironmentState {
    const existing = this.environments.get(pondId);
    if (existing) return existing;
    const pond = this.database.ponds[pondId];
    const environment: EnvironmentState = {
      ph: pond?.sensors.ph ?? SIMULATION_CONFIG.normal.ph,
      do: pond?.sensors.do ?? SIMULATION_CONFIG.normal.do,
      temperature: pond?.sensors.temperature ?? SIMULATION_CONFIG.normal.temperature,
      waterLevel: pond?.sensors.waterLevel ?? SIMULATION_CONFIG.normal.waterLevel,
      salinity: pond?.sensors.salinity ?? SIMULATION_CONFIG.normal.salinity,
      rainElapsedSec: 0,
      scenarioElapsedSec: 0,
      lastStepAtMs: null,
    };
    this.environments.set(pondId, environment);
    return environment;
  }

  private consumeDeltaSec(environment: EnvironmentState, timestampMs: number): number {
    const previous = environment.lastStepAtMs ?? timestampMs - this.scenarioStepMs;
    environment.lastStepAtMs = timestampMs;
    return clamp(
      (timestampMs - previous) / 1_000,
      SIMULATION_CONFIG.step.minimumDeltaSec,
      SIMULATION_CONFIG.step.maximumDeltaSec,
    );
  }

  private clampEnvironment(environment: EnvironmentState): void {
    environment.ph = clamp(environment.ph, SIMULATION_CONFIG.sensors.ph.min, SIMULATION_CONFIG.sensors.ph.max);
    environment.do = clamp(environment.do, SIMULATION_CONFIG.sensors.do.min, SIMULATION_CONFIG.sensors.do.max);
    environment.temperature = clamp(environment.temperature, SIMULATION_CONFIG.sensors.temperature.min, SIMULATION_CONFIG.sensors.temperature.max);
    environment.waterLevel = clamp(environment.waterLevel, SIMULATION_CONFIG.sensors.waterLevel.min, SIMULATION_CONFIG.sensors.waterLevel.max);
    environment.salinity = clamp(environment.salinity, SIMULATION_CONFIG.sensors.salinity.min, SIMULATION_CONFIG.sensors.salinity.max);
  }

  private initializeTelemetryClock(): void {
    for (const [pondId, records] of Object.entries(this.database.telemetry)) {
      const latest = Math.max(0, ...Object.values(records).map((record) => record.timestampMs));
      this.lastTelemetryAtMs.set(pondId, latest);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

import { MockPondDataSource } from "./MockPondDataSource";
import type { DemoScenario } from "./MockIoTController";
import type { PondDataSource } from "./PondDataSource";

export interface DemoScenarioSource {
  setDemoScenario(pondId: string, scenario: DemoScenario): void;
  stopDemoScenario(): void;
  getDemoScenarioState(): { scenario: DemoScenario; rainIntensityMmPerHour: number };
}

let pondDataSource: PondDataSource | null = null;

export function getPondDataSource(): PondDataSource {
  pondDataSource ??= new MockPondDataSource();
  return pondDataSource;
}

export function isDemoScenarioSource(source: PondDataSource): source is PondDataSource & DemoScenarioSource {
  return "setDemoScenario" in source && typeof source.setDemoScenario === "function";
}

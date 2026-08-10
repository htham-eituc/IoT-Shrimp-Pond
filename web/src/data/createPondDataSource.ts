import { readFirebaseConfig, type FirebaseWebConfig } from "../firebase/client";
import { FirebasePondDataSource } from "./FirebasePondDataSource";
import { MockPondDataSource } from "./MockPondDataSource";
import type { DemoScenario } from "./MockIoTController";
import type { PondAccessContext, PondDataSource } from "./PondDataSource";

export interface DemoScenarioSource {
  setDemoScenario(pondId: string, scenario: DemoScenario): void;
  stopDemoScenario(): void;
  getDemoScenarioState(): { scenario: DemoScenario; rainIntensityMmPerHour: number };
}

export interface PondDataSourceFactoryDependencies {
  createFirebaseSource?(config: FirebaseWebConfig, access: PondAccessContext): PondDataSource;
}

export function createPondDataSource(
  environment: Record<string, string | boolean | undefined>,
  access: PondAccessContext,
  dependencies: PondDataSourceFactoryDependencies = {},
): PondDataSource {
  const mode = readEnvironmentValue(environment, "VITE_DATA_MODE")?.toLowerCase() ?? "mock";
  if (mode === "mock") return new MockPondDataSource(access);
  if (mode !== "firebase") {
    throw new Error(`VITE_DATA_MODE must be "mock" or "firebase"; received "${mode}".`);
  }

  const config = readFirebaseConfig(environment);
  return dependencies.createFirebaseSource?.(config, access) ?? new FirebasePondDataSource(config, access);
}

export function isDemoScenarioSource(source: PondDataSource): source is PondDataSource & DemoScenarioSource {
  return "setDemoScenario" in source && typeof source.setDemoScenario === "function";
}

function readEnvironmentValue(
  environment: Record<string, string | boolean | undefined>,
  key: string,
): string | undefined {
  const value = environment[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

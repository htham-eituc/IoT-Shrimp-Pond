import { FirebasePondDataSource, type FirebasePondConfig } from "./FirebasePondDataSource";
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
  pondDataSource ??= createPondDataSource(import.meta.env);
  return pondDataSource;
}

export interface PondDataSourceFactoryDependencies {
  createFirebaseSource?(config: FirebasePondConfig): PondDataSource;
}

export function createPondDataSource(
  environment: Record<string, string | boolean | undefined>,
  dependencies: PondDataSourceFactoryDependencies = {},
): PondDataSource {
  const mode = readEnvironmentValue(environment, "VITE_DATA_MODE")?.toLowerCase() ?? "mock";
  if (mode === "mock") return new MockPondDataSource();
  if (mode !== "firebase") {
    throw new Error(`VITE_DATA_MODE must be "mock" or "firebase"; received "${mode}".`);
  }

  const config: FirebasePondConfig = {
    apiKey: requireEnvironmentValue(environment, "VITE_FIREBASE_API_KEY"),
    authDomain: requireEnvironmentValue(environment, "VITE_FIREBASE_AUTH_DOMAIN"),
    databaseURL: requireEnvironmentValue(environment, "VITE_FIREBASE_DATABASE_URL"),
    projectId: requireEnvironmentValue(environment, "VITE_FIREBASE_PROJECT_ID"),
    storageBucket: requireEnvironmentValue(environment, "VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requireEnvironmentValue(environment, "VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: requireEnvironmentValue(environment, "VITE_FIREBASE_APP_ID"),
  };
  return dependencies.createFirebaseSource?.(config) ?? new FirebasePondDataSource(config);
}

export function isDemoScenarioSource(source: PondDataSource): source is PondDataSource & DemoScenarioSource {
  return "setDemoScenario" in source && typeof source.setDemoScenario === "function";
}

function requireEnvironmentValue(
  environment: Record<string, string | boolean | undefined>,
  key: string,
): string {
  const value = readEnvironmentValue(environment, key);
  if (!value) throw new Error(`${key} is required when VITE_DATA_MODE=firebase.`);
  return value;
}

function readEnvironmentValue(
  environment: Record<string, string | boolean | undefined>,
  key: string,
): string | undefined {
  const value = environment[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

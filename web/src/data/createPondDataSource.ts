import {
  getApps,
  initializeApp,
  type FirebaseOptions,
} from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { FirebasePondDataSource } from "./FirebasePondDataSource";
import {
  MockPondDataSource,
  type MockPondDataSourceOptions,
} from "./MockPondDataSource";
import {
  PondDataSourceError,
  type PondDataSource,
} from "./PondDataSource";

const FIREBASE_APP_NAME = "smart-shrimp-pond-dashboard";

export type PondDataSourceMode = "mock" | "firebase";

export interface PondDataSourceEnvironment {
  readonly VITE_POND_DATA_SOURCE?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_DATABASE_URL?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

export interface CreatePondDataSourceOptions {
  readonly env?: PondDataSourceEnvironment;
  readonly mock?: MockPondDataSourceOptions;
}

function resolveMode(env: PondDataSourceEnvironment): PondDataSourceMode {
  const configuredMode = env.VITE_POND_DATA_SOURCE?.trim().toLowerCase();
  if (configuredMode === undefined || configuredMode.length === 0 || configuredMode === "mock") {
    return "mock";
  }
  if (configuredMode === "firebase") {
    return "firebase";
  }
  throw new PondDataSourceError(
    "configuration-error",
    "VITE_POND_DATA_SOURCE must be either 'mock' or 'firebase'.",
  );
}

function requireEnvironmentValue(
  env: PondDataSourceEnvironment,
  key: keyof PondDataSourceEnvironment,
): string {
  const value = env[key]?.trim();
  if (value === undefined || value.length === 0) {
    throw new PondDataSourceError(
      "configuration-error",
      `${key} is required when VITE_POND_DATA_SOURCE=firebase.`,
    );
  }
  return value;
}

function createFirebaseOptions(env: PondDataSourceEnvironment): FirebaseOptions {
  return {
    apiKey: requireEnvironmentValue(env, "VITE_FIREBASE_API_KEY"),
    authDomain: requireEnvironmentValue(env, "VITE_FIREBASE_AUTH_DOMAIN"),
    databaseURL: requireEnvironmentValue(env, "VITE_FIREBASE_DATABASE_URL"),
    projectId: requireEnvironmentValue(env, "VITE_FIREBASE_PROJECT_ID"),
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    appId: requireEnvironmentValue(env, "VITE_FIREBASE_APP_ID"),
  };
}

export function createPondDataSource(
  options: CreatePondDataSourceOptions = {},
): PondDataSource {
  const env = options.env ?? (import.meta.env as PondDataSourceEnvironment);
  if (resolveMode(env) === "mock") {
    return new MockPondDataSource(options.mock);
  }

  const existingApp = getApps().find((app) => app.name === FIREBASE_APP_NAME);
  const app = existingApp ?? initializeApp(createFirebaseOptions(env), FIREBASE_APP_NAME);
  return new FirebasePondDataSource(getAuth(app), getDatabase(app));
}

let defaultDataSource: PondDataSource | undefined;

export function getPondDataSource(): PondDataSource {
  defaultDataSource ??= createPondDataSource();
  return defaultDataSource;
}

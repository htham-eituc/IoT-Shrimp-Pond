import { readFirebaseConfig, type FirebaseWebConfig } from "../firebase/client";
import { FirebasePondDataSource } from "./FirebasePondDataSource";
import type { PondAccessContext, PondDataSource } from "./PondDataSource";

export interface PondDataSourceFactoryDependencies {
  createFirebaseSource?(config: FirebaseWebConfig, access: PondAccessContext): PondDataSource;
}

export function createPondDataSource(
  environment: Record<string, string | boolean | undefined>,
  access: PondAccessContext,
  dependencies: PondDataSourceFactoryDependencies = {},
): PondDataSource {
  const config = readFirebaseConfig(environment);
  return dependencies.createFirebaseSource?.(config, access) ?? new FirebasePondDataSource(config, access);
}

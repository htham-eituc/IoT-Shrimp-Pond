import type { FirebaseClient, FirebaseWebConfig } from "../firebase/client";
import { getFirebaseClient, readFirebaseConfig } from "../firebase/client";
import type { AuthSessionState, AuthSource, AuthUnsubscribe } from "./AuthSource";
import { AuthenticationError } from "./authErrors";
import { FirebaseAuthSource } from "./FirebaseAuthSource";

let authSource: AuthSource | null = null;

export interface AuthSourceFactoryDependencies {
  createFirebaseClient?(config: FirebaseWebConfig): FirebaseClient;
  createFirebaseSource?(client: FirebaseClient): AuthSource;
}

export function getAuthSource(): AuthSource {
  authSource ??= createAuthSource(import.meta.env);
  return authSource;
}

export function createAuthSource(
  environment: Record<string, string | boolean | undefined>,
  dependencies: AuthSourceFactoryDependencies = {},
): AuthSource {
  try {
    const config = readFirebaseConfig(environment);
    const client = dependencies.createFirebaseClient?.(config) ?? getFirebaseClient(config);
    return dependencies.createFirebaseSource?.(client)
      ?? new FirebaseAuthSource(client.auth, client.database);
  } catch (reason) {
    return new UnavailableAuthSource(
      new AuthenticationError("configuration", { cause: reason }),
    );
  }
}

class UnavailableAuthSource implements AuthSource {
  constructor(private readonly error: AuthenticationError) {}

  observeSession(
    _listener: (state: AuthSessionState) => void,
    onError?: (error: Error) => void,
  ): AuthUnsubscribe {
    queueMicrotask(() => onError?.(this.error));
    return () => undefined;
  }

  async signIn(): Promise<void> {
    throw this.error;
  }

  async signOut(): Promise<void> {
    throw this.error;
  }
}

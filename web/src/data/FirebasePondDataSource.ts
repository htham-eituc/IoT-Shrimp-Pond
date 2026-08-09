import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type Auth,
} from "firebase/auth";
import {
  endAt,
  get,
  getDatabase,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  runTransaction,
  set,
  startAt,
  type Database,
  type QueryConstraint,
} from "firebase/database";
import type {
  AuthenticatedUser,
  Command,
  DeepPartial,
  KeyedRecord,
  PondAlert,
  PondEvent,
  PondSettings,
  PondState,
  TelemetryRecord,
} from "../domain";
import type {
  CreateCommandRequest,
  PondDataSource,
  SubscriptionCallback,
  SubscriptionErrorCallback,
  TelemetryQueryOptions,
  Unsubscribe,
} from "./PondDataSource";
import {
  parseCommand,
  parseKeyedRecordList,
  parsePondAlert,
  parsePondEvent,
  parsePondSettings,
  parsePondState,
  parseTelemetryRecord,
  parseUserProfile,
} from "./firebaseMappers";

const FIREBASE_APP_NAME = "smart-shrimp-pond-dashboard";

export interface FirebasePondConfig extends FirebaseOptions {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export class FirebasePondDataSource implements PondDataSource {
  private readonly auth: Auth;
  private readonly database: Database;
  private currentUser: AuthenticatedUser | null = null;

  constructor(config: FirebasePondConfig) {
    const app = getApps().some((candidate) => candidate.name === FIREBASE_APP_NAME)
      ? getApp(FIREBASE_APP_NAME)
      : initializeApp(config, FIREBASE_APP_NAME);
    this.auth = getAuth(app);
    this.database = getDatabase(app);
  }

  async restoreSession(): Promise<AuthenticatedUser | null> {
    await this.auth.authStateReady();
    const firebaseUser = this.auth.currentUser;
    if (!firebaseUser) {
      this.currentUser = null;
      return null;
    }

    try {
      return await this.loadFarmer(firebaseUser.uid, firebaseUser.email ?? "");
    } catch (error) {
      await firebaseSignOut(this.auth);
      this.currentUser = null;
      throw error;
    }
  }

  async signIn(email: string, password: string): Promise<AuthenticatedUser> {
    await setPersistence(this.auth, browserLocalPersistence);
    const credential = await signInWithEmailAndPassword(this.auth, email.trim(), password);
    try {
      return await this.loadFarmer(credential.user.uid, credential.user.email ?? email.trim());
    } catch (error) {
      await firebaseSignOut(this.auth);
      this.currentUser = null;
      throw error;
    }
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
    this.currentUser = null;
  }

  getCurrentUser(): AuthenticatedUser | null {
    return this.currentUser ? structuredClone(this.currentUser) : null;
  }

  subscribePond(
    pondId: string,
    callback: SubscriptionCallback<PondState | null>,
    onError?: SubscriptionErrorCallback,
  ): Unsubscribe {
    this.assertFarmerForPond(pondId);
    return onValue(
      ref(this.database, `ponds/${pondId}`),
      (snapshot) => deliver(() => snapshot.exists() ? parsePondState(snapshot.val(), `ponds/${pondId}`) : null, callback, onError),
      (error) => onError?.(toError(error)),
    );
  }

  subscribeSettings(
    pondId: string,
    callback: SubscriptionCallback<PondSettings | null>,
    onError?: SubscriptionErrorCallback,
  ): Unsubscribe {
    this.assertFarmerForPond(pondId);
    return onValue(
      ref(this.database, `settings/${pondId}`),
      (snapshot) => deliver(() => snapshot.exists() ? parsePondSettings(snapshot.val(), `settings/${pondId}`) : null, callback, onError),
      (error) => onError?.(toError(error)),
    );
  }

  subscribeAlerts(
    pondId: string,
    callback: SubscriptionCallback<Array<KeyedRecord<PondAlert>>>,
    onError?: SubscriptionErrorCallback,
  ): Unsubscribe {
    this.assertFarmerForPond(pondId);
    return onValue(
      ref(this.database, `alerts/${pondId}`),
      (snapshot) => deliver(
        () => parseKeyedRecordList(snapshot.val(), parsePondAlert, `alerts/${pondId}`),
        callback,
        onError,
      ),
      (error) => onError?.(toError(error)),
    );
  }

  subscribeEvents(
    pondId: string,
    callback: SubscriptionCallback<Array<KeyedRecord<PondEvent>>>,
    onError?: SubscriptionErrorCallback,
  ): Unsubscribe {
    this.assertFarmerForPond(pondId);
    return onValue(
      ref(this.database, `events/${pondId}`),
      (snapshot) => deliver(
        () => parseKeyedRecordList(snapshot.val(), parsePondEvent, `events/${pondId}`),
        callback,
        onError,
      ),
      (error) => onError?.(toError(error)),
    );
  }

  subscribeCommands(
    pondId: string,
    callback: SubscriptionCallback<Array<KeyedRecord<Command>>>,
    onError?: SubscriptionErrorCallback,
  ): Unsubscribe {
    this.assertFarmerForPond(pondId);
    return onValue(
      ref(this.database, `commands/${pondId}`),
      (snapshot) => deliver(
        () => parseKeyedRecordList(snapshot.val(), parseCommand, `commands/${pondId}`),
        callback,
        onError,
      ),
      (error) => onError?.(toError(error)),
    );
  }

  async getTelemetry(
    pondId: string,
    queryOptions: TelemetryQueryOptions = {},
  ): Promise<Array<KeyedRecord<TelemetryRecord>>> {
    this.assertFarmerForPond(pondId);
    const constraints: QueryConstraint[] = [orderByChild("timestampMs")];
    if (queryOptions.startAtMs !== undefined) constraints.push(startAt(queryOptions.startAtMs));
    if (queryOptions.endAtMs !== undefined) constraints.push(endAt(queryOptions.endAtMs));
    if (queryOptions.limit !== undefined) {
      if (!Number.isInteger(queryOptions.limit) || queryOptions.limit <= 0) {
        throw new Error("Telemetry limit must be a positive integer.");
      }
      constraints.push(limitToLast(queryOptions.limit));
    }

    const snapshot = await get(query(ref(this.database, `telemetry/${pondId}`), ...constraints));
    return parseKeyedRecordList(snapshot.val(), parseTelemetryRecord, `telemetry/${pondId}`)
      .sort((left, right) => left.value.timestampMs - right.value.timestampMs);
  }

  async updateSettings(pondId: string, changes: DeepPartial<PondSettings>): Promise<PondSettings> {
    this.assertFarmerForPond(pondId);
    const settingsRef = ref(this.database, `settings/${pondId}`);
    const result = await runTransaction(
      settingsRef,
      (currentValue) => {
        if (currentValue === null) return;
        return mergePondSettings(parsePondSettings(currentValue, `settings/${pondId}`), changes);
      },
      { applyLocally: false },
    );
    if (!result.committed || !result.snapshot.exists()) {
      throw new Error(`Settings not found for pond ${pondId}.`);
    }
    return parsePondSettings(result.snapshot.val(), `settings/${pondId}`);
  }

  async updatePondName(pondId: string, name: string): Promise<void> {
    this.assertFarmerForPond(pondId);
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      throw new Error("Pond name must be 1 to 100 characters.");
    }
    await set(ref(this.database, `ponds/${pondId}/name`), trimmedName);
  }

  async createCommand(pondId: string, request: CreateCommandRequest): Promise<KeyedRecord<Command>> {
    this.assertFarmerForPond(pondId);
    const createdAtMs = request.createdAtMs ?? Date.now();
    if (!Number.isFinite(createdAtMs) || createdAtMs < 0) {
      throw new Error("Command createdAtMs must be a nonnegative number.");
    }
    const command: Command = {
      device: request.device,
      action: request.action,
      source: "manual",
      createdAtMs,
      status: "pending",
      processedAtMs: null,
    };
    const commandRef = push(ref(this.database, `commands/${pondId}`));
    if (!commandRef.key) throw new Error("Firebase could not allocate a command ID.");
    await set(commandRef, command);
    return { id: commandRef.key, value: command };
  }

  private async loadFarmer(uid: string, email: string): Promise<AuthenticatedUser> {
    const snapshot = await get(ref(this.database, `users/${uid}`));
    if (!snapshot.exists()) throw new Error("No dashboard profile exists for this Firebase account.");
    const profile = parseUserProfile(snapshot.val(), `users/${uid}`);
    if (profile.role !== "farmer") throw new Error("This Firebase account is not authorized as a farmer.");
    this.currentUser = { uid, email, profile };
    return structuredClone(this.currentUser);
  }

  private assertFarmerForPond(pondId: string): void {
    if (!this.currentUser) throw new Error("Sign in before reading pond data.");
    if (this.currentUser.profile.role !== "farmer" || this.currentUser.profile.pondId !== pondId) {
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

function deliver<T>(
  readValue: () => T,
  callback: SubscriptionCallback<T>,
  onError?: SubscriptionErrorCallback,
): void {
  try {
    callback(readValue());
  } catch (error) {
    onError?.(toError(error));
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

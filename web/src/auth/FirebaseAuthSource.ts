import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type Auth,
  type Persistence,
  type User,
} from "firebase/auth";
import { get, ref, type Database } from "firebase/database";
import type { UserProfile } from "../domain";
import type { AuthenticatedFarmer } from "../domain/session";
import { parseUserProfile } from "../data/firebaseMappers";
import type { AuthSessionState, AuthSource, AuthUnsubscribe } from "./AuthSource";
import {
  AuthenticationError,
  isFirebasePermissionDenied,
  normalizeFirebaseAuthError,
} from "./authErrors";

interface FirebaseIdentity {
  uid: string;
  email: string | null;
}

export interface FirebaseAuthAdapter {
  setPersistence(auth: Auth, persistence: Persistence): Promise<void>;
  signIn(auth: Auth, email: string, password: string): Promise<void>;
  signOut(auth: Auth): Promise<void>;
  observe(
    auth: Auth,
    listener: (user: FirebaseIdentity | null) => void,
    onError: (error: unknown) => void,
  ): AuthUnsubscribe;
  loadUserProfile(database: Database, uid: string): Promise<unknown | null>;
}

const firebaseAuthAdapter: FirebaseAuthAdapter = {
  setPersistence,
  signIn: async (auth, email, password) => {
    await signInWithEmailAndPassword(auth, email, password);
  },
  signOut: (auth) => firebaseSignOut(auth),
  observe: (auth, listener, onError) => onAuthStateChanged(
    auth,
    (user: User | null) => listener(user ? { uid: user.uid, email: user.email } : null),
    onError,
  ),
  loadUserProfile: async (database, uid) => {
    const snapshot = await get(ref(database, `users/${uid}`));
    return snapshot.exists() ? snapshot.val() : null;
  },
};

export class FirebaseAuthSource implements AuthSource {
  constructor(
    private readonly auth: Auth,
    private readonly database: Database,
    private readonly adapter: FirebaseAuthAdapter = firebaseAuthAdapter,
  ) {}

  observeSession(
    listener: (state: AuthSessionState) => void,
    onError?: (error: Error) => void,
  ): AuthUnsubscribe {
    let active = true;
    let validationSequence = 0;

    const unsubscribe = this.adapter.observe(
      this.auth,
      (identity) => {
        const sequence = ++validationSequence;
        if (!identity) {
          listener({ status: "signed-out" });
          return;
        }

        listener({ status: "validating-profile" });
        void this.resolveFarmer(identity)
          .then((user) => {
            if (active && sequence === validationSequence) {
              listener({ status: "authenticated", user });
            }
          })
          .catch((reason: unknown) => {
            if (!active || sequence !== validationSequence) return;
            onError?.(toProfileAuthorizationError(reason));
            void this.adapter.signOut(this.auth).catch(() => undefined);
          });
      },
      (reason) => onError?.(normalizeFirebaseAuthError(reason)),
    );

    return () => {
      active = false;
      validationSequence += 1;
      unsubscribe();
    };
  }

  async signIn(email: string, password: string, rememberMe: boolean): Promise<void> {
    try {
      await this.adapter.setPersistence(
        this.auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence,
      );
      await this.adapter.signIn(this.auth, email.trim(), password);
    } catch (reason) {
      throw normalizeFirebaseAuthError(reason);
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.adapter.signOut(this.auth);
    } catch (reason) {
      throw normalizeFirebaseAuthError(reason);
    }
  }

  private async resolveFarmer(identity: FirebaseIdentity): Promise<AuthenticatedFarmer> {
    let value: unknown | null;
    try {
      value = await this.adapter.loadUserProfile(this.database, identity.uid);
    } catch (reason) {
      if (isFirebasePermissionDenied(reason)) {
        throw new AuthenticationError("profile-permission-denied", { cause: reason });
      }
      throw normalizeFirebaseAuthError(reason);
    }

    if (value === null || value === undefined) {
      throw new AuthenticationError("profile-missing");
    }
    if (!isRecord(value)) {
      throw new AuthenticationError("profile-invalid");
    }
    if (value.role !== "farmer") {
      throw new AuthenticationError("role-denied");
    }
    if (typeof value.pondId !== "string" || value.pondId.trim() === "") {
      throw new AuthenticationError("pond-invalid");
    }

    let profile: UserProfile;
    try {
      profile = parseUserProfile(value, `users/${identity.uid}`);
    } catch (reason) {
      throw new AuthenticationError("profile-invalid", { cause: reason });
    }

    return {
      uid: identity.uid,
      email: identity.email,
      displayName: profile.displayName,
      role: "farmer",
      pondId: profile.pondId,
    };
  }
}

function toProfileAuthorizationError(reason: unknown): AuthenticationError {
  if (reason instanceof AuthenticationError) return reason;
  return new AuthenticationError("profile-invalid", { cause: reason });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

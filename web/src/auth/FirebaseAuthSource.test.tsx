import { renderToStaticMarkup } from "react-dom/server";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  type Auth,
} from "firebase/auth";
import type { Database } from "firebase/database";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginScreen } from "../components/LoginScreen";
import type { UserProfile } from "../domain";
import { setLocale } from "../i18n";
import type { AuthSessionState } from "./AuthSource";
import { AuthenticationError } from "./authErrors";
import { createAuthSource } from "./createAuthSource";
import { FirebaseAuthSource, type FirebaseAuthAdapter } from "./FirebaseAuthSource";

const TEST_PROFILE: UserProfile = {
  role: "farmer",
  pondId: "pond-001",
  displayName: "Pond Operator",
};

afterEach(() => vi.unstubAllGlobals());

describe("FirebaseAuthSource", () => {
  it("uses the Firebase SDK boundary for Email/Password login and validates the profile", async () => {
    const harness = createHarness();
    const states: AuthSessionState[] = [];
    harness.source.observeSession((state) => states.push(state));

    await harness.source.signIn(" farmer@pond.test ", "private-password", true);
    expect(harness.adapter.setPersistence).toHaveBeenCalledWith(
      harness.auth,
      browserLocalPersistence,
    );
    expect(harness.adapter.signIn).toHaveBeenCalledWith(
      harness.auth,
      "farmer@pond.test",
      "private-password",
    );

    harness.emitUser({ uid: "firebase-uid-17", email: "farmer@pond.test" });
    await vi.waitFor(() => expect(states.at(-1)?.status).toBe("authenticated"));

    expect(states[0]).toEqual({ status: "validating-profile" });
    expect(harness.adapter.loadUserProfile).toHaveBeenCalledWith(
      harness.database,
      "firebase-uid-17",
    );
    expect(states.at(-1)).toEqual({
      status: "authenticated",
      user: {
        uid: "firebase-uid-17",
        email: "farmer@pond.test",
        displayName: "Pond Operator",
        role: "farmer",
        pondId: "pond-001",
      },
    });
  });

  it("uses Firebase session persistence when Remember me is unchecked", async () => {
    const harness = createHarness();

    await harness.source.signIn("farmer@pond.test", "private-password", false);

    expect(harness.adapter.setPersistence).toHaveBeenCalledWith(
      harness.auth,
      browserSessionPersistence,
    );
    expect(harness.adapter.signIn).toHaveBeenCalledWith(
      harness.auth,
      "farmer@pond.test",
      "private-password",
    );
  });

  it("never writes the password through application local or session storage", async () => {
    const localStorage = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() };
    const sessionStorage = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("window", { localStorage, sessionStorage });
    const harness = createHarness();

    await harness.source.signIn("farmer@pond.test", "must-not-persist", true);

    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
    expect(harness.source).not.toHaveProperty("password");
  });

  it("maps invalid credentials without exposing the Firebase message", async () => {
    const firebaseFailure = Object.assign(new Error("Firebase internal detail"), {
      code: "auth/invalid-credential",
    });
    const harness = createHarness({
      signIn: vi.fn().mockRejectedValue(firebaseFailure),
    });

    await expect(harness.source.signIn("farmer@pond.test", "wrong", true))
      .rejects.toMatchObject({ code: "invalid-credentials" });
  });

  it.each([
    ["auth/wrong-password", "invalid-credentials"],
    ["auth/user-not-found", "invalid-credentials"],
    ["auth/network-request-failed", "network"],
  ] as const)("maps Firebase failure %s to %s", async (firebaseCode, expectedCode) => {
    const harness = createHarness({
      signIn: vi.fn().mockRejectedValue(
        Object.assign(new Error("Internal Firebase diagnostic"), { code: firebaseCode }),
      ),
    });

    await expect(harness.source.signIn("account@pond.test", "not-logged", false))
      .rejects.toMatchObject({ code: expectedCode });
  });

  it("rejects a Firebase identity whose profile is missing", async () => {
    await expectAuthorizationFailure(null, "profile-missing");
  });

  it("rejects a Firebase identity with the device role", async () => {
    await expectAuthorizationFailure({
      role: "device",
      pondId: "pond-001",
      displayName: "Controller",
    }, "role-denied");
  });

  it("rejects a Firebase identity whose pondId is missing", async () => {
    await expectAuthorizationFailure({
      role: "farmer",
      displayName: "Unassigned Farmer",
    }, "pond-invalid");
  });

  it("rejects malformed farmer metadata", async () => {
    await expectAuthorizationFailure({
      role: "farmer",
      pondId: "pond-001",
      displayName: 42,
    }, "profile-invalid");
  });

  it("rejects permission-denied while reading /users/{uid}", async () => {
    const harness = createHarness({
      loadUserProfile: vi.fn().mockRejectedValue(
        Object.assign(new Error("Permission denied"), { code: "PERMISSION_DENIED" }),
      ),
    });
    const errors: Error[] = [];
    harness.source.observeSession(() => undefined, (error) => errors.push(error));

    harness.emitUser({ uid: "farmer-uid", email: "farmer@pond.test" });
    await vi.waitFor(() => expect(errors).toHaveLength(1));

    expect(errors[0]).toMatchObject({ code: "profile-permission-denied" });
    expect(harness.adapter.signOut).toHaveBeenCalledWith(harness.auth);
  });

  it("restores a persisted Firebase session by reloading its profile", async () => {
    const harness = createHarness();
    const states: AuthSessionState[] = [];
    harness.source.observeSession((state) => states.push(state));

    harness.emitUser({ uid: "restored-uid", email: "restored@pond.test" });
    await vi.waitFor(() => expect(states.at(-1)?.status).toBe("authenticated"));

    expect(harness.adapter.signIn).not.toHaveBeenCalled();
    expect(harness.adapter.loadUserProfile).toHaveBeenCalledWith(harness.database, "restored-uid");
  });

  it("emits signed-out without loading a profile", () => {
    const harness = createHarness();
    const states: AuthSessionState[] = [];
    harness.source.observeSession((state) => states.push(state));

    harness.emitUser(null);

    expect(states).toEqual([{ status: "signed-out" }]);
    expect(harness.adapter.loadUserProfile).not.toHaveBeenCalled();
  });

  it("removes an active authorized session when Firebase reports sign-out", async () => {
    const harness = createHarness();
    const states: AuthSessionState[] = [];
    harness.source.observeSession((state) => states.push(state));

    harness.emitUser({ uid: "active-uid", email: "farmer@pond.test" });
    await vi.waitFor(() => expect(states.at(-1)?.status).toBe("authenticated"));
    harness.emitUser(null);

    expect(states.at(-1)).toEqual({ status: "signed-out" });
  });

  it("unregisters the SDK observer and suppresses pending profile results", async () => {
    let resolveProfile!: (profile: UserProfile) => void;
    const pendingProfile = new Promise<UserProfile>((resolve) => {
      resolveProfile = resolve;
    });
    const harness = createHarness({
      loadUserProfile: vi.fn(() => pendingProfile),
    });
    const states: AuthSessionState[] = [];
    const unsubscribe = harness.source.observeSession((state) => states.push(state));

    harness.emitUser({ uid: "pending-uid", email: "farmer@pond.test" });
    unsubscribe();
    resolveProfile(TEST_PROFILE);
    await Promise.resolve();

    expect(harness.adapter.observe).toHaveBeenCalledTimes(1);
    expect(harness.sdkUnsubscribe).toHaveBeenCalledTimes(1);
    expect(states).toEqual([{ status: "validating-profile" }]);
  });

  it("resolves a fresh profile when the Firebase account changes", async () => {
    const profiles: Record<string, UserProfile> = {
      "user-a": { role: "farmer", pondId: "pond-a", displayName: "Farmer A" },
      "user-b": { role: "farmer", pondId: "pond-b", displayName: "Farmer B" },
    };
    const harness = createHarness({
      loadUserProfile: vi.fn(async (_database, uid) => profiles[uid] ?? null),
    });
    const states: AuthSessionState[] = [];
    harness.source.observeSession((state) => states.push(state));

    harness.emitUser({ uid: "user-a", email: "a@pond.test" });
    await vi.waitFor(() => expect(states.at(-1)).toMatchObject({ status: "authenticated", user: { uid: "user-a" } }));
    harness.emitUser(null);
    harness.emitUser({ uid: "user-b", email: "b@pond.test" });
    await vi.waitFor(() => expect(states.at(-1)).toMatchObject({ status: "authenticated", user: { uid: "user-b", pondId: "pond-b" } }));

    expect(harness.adapter.loadUserProfile).toHaveBeenNthCalledWith(1, harness.database, "user-a");
    expect(harness.adapter.loadUserProfile).toHaveBeenNthCalledWith(2, harness.database, "user-b");
  });

  it("logs out through Firebase Auth", async () => {
    const harness = createHarness();

    await harness.source.signOut();

    expect(harness.adapter.signOut).toHaveBeenCalledTimes(1);
    expect(harness.adapter.signOut).toHaveBeenCalledWith(harness.auth);
  });

  it("reports missing Firebase environment configuration as a safe application error", async () => {
    const source = createAuthSource({});
    const errors: Error[] = [];
    source.observeSession(() => undefined, (error) => errors.push(error));

    await vi.waitFor(() => expect(errors).toHaveLength(1));
    expect(errors[0]).toMatchObject({ code: "configuration" });
    expect(errors[0].message).not.toContain("VITE_FIREBASE_API_KEY");
  });

  it.each([
    ["vi", "Đang đăng nhập"],
    ["en", "Signing in"],
  ] as const)("renders the duplicate-submission guard in %s", async (locale, label) => {
    await setLocale(locale, null);
    const markup = renderToStaticMarkup(
      <LoginScreen
        emailHint=""
        initialRememberMe
        error={null}
        loading
        onLogin={async () => true}
        onForgetRememberedAccount={() => undefined}
      />,
    );

    expect(markup).toContain(label);
    expect((markup.match(/disabled=""/g) ?? [])).toHaveLength(5);
  });

  it.each([
    ["vi", "Ghi nhớ đăng nhập", "Hiện mật khẩu"],
    ["en", "Remember me", "Show password"],
  ] as const)("renders password-manager fields and safe credential controls in %s", async (locale, rememberLabel, showLabel) => {
    await setLocale(locale, null);
    const markup = renderToStaticMarkup(
      <LoginScreen
        emailHint="operator@pond.test"
        initialRememberMe
        error={null}
        loading={false}
        onLogin={async () => true}
        onForgetRememberedAccount={() => undefined}
      />,
    );

    expect(markup).toContain('type="email"');
    expect(markup).toContain('name="email"');
    expect(markup).toContain('autoComplete="username"');
    expect(markup).toContain('type="password"');
    expect(markup).toContain('name="password"');
    expect(markup).toContain('autoComplete="current-password"');
    expect(markup).toContain('name="rememberMe"');
    expect(markup).toContain('checked=""');
    expect(markup).toContain(rememberLabel);
    expect(markup).toContain(`aria-label="${showLabel}"`);
  });
});

async function expectAuthorizationFailure(
  profile: unknown | null,
  code: AuthenticationError["code"],
): Promise<void> {
  const harness = createHarness({
    loadUserProfile: vi.fn().mockResolvedValue(profile),
  });
  const errors: Error[] = [];
  const states: AuthSessionState[] = [];
  harness.source.observeSession((state) => states.push(state), (error) => errors.push(error));

  harness.emitUser({ uid: "unauthorized-uid", email: "account@pond.test" });
  await vi.waitFor(() => expect(errors).toHaveLength(1));

  expect(states).toEqual([{ status: "validating-profile" }]);
  expect(errors[0]).toBeInstanceOf(AuthenticationError);
  expect(errors[0]).toMatchObject({ code });
  expect(harness.adapter.signOut).toHaveBeenCalledWith(harness.auth);
}

function createHarness(overrides: Partial<FirebaseAuthAdapter> = {}) {
  const auth = {} as Auth;
  const database = {} as Database;
  let sessionListener: ((user: { uid: string; email: string | null } | null) => void) | null = null;
  const sdkUnsubscribe = vi.fn();

  const adapter: FirebaseAuthAdapter = {
    setPersistence: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    observe: vi.fn((_auth, listener) => {
      sessionListener = listener;
      return sdkUnsubscribe;
    }),
    loadUserProfile: vi.fn().mockResolvedValue(TEST_PROFILE),
    ...overrides,
  };

  return {
    auth,
    database,
    adapter,
    sdkUnsubscribe,
    source: new FirebaseAuthSource(auth, database, adapter),
    emitUser(user: { uid: string; email: string | null } | null) {
      if (!sessionListener) throw new Error("Session observer is not installed.");
      sessionListener(user);
    },
  };
}

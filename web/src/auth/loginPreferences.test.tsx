import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { LoginScreen } from "../components/LoginScreen";
import { setLocale } from "../i18n";
import {
  LOGIN_PREFERENCE_STORAGE_KEY,
  LoginPreferenceManager,
  readLoginPreference,
  type LoginPreferenceStorage,
} from "./loginPreferences";

afterEach(async () => setLocale("vi", null));

describe("remembered farmer login preference", () => {
  it("saves only the authenticated farmer email after complete authorization", () => {
    const storage = createMemoryStorage();
    const manager = new LoginPreferenceManager(storage);

    manager.beginLoginAttempt(true);
    expect(storage.getItem(LOGIN_PREFERENCE_STORAGE_KEY)).toBeNull();

    expect(manager.completeAuthorizedFarmer(" Farmer@Pond.Test ")).toEqual({
      rememberLogin: true,
      lastLoginEmail: "Farmer@Pond.Test",
    });
    expect(readLoginPreference(storage)).toEqual({
      rememberLogin: true,
      lastLoginEmail: "Farmer@Pond.Test",
    });
  });

  it("does not persist an email when Remember me is disabled", () => {
    const storage = createMemoryStorage({ rememberLogin: true, lastLoginEmail: "farmer-a@pond.test" });
    const manager = new LoginPreferenceManager(storage);

    manager.beginLoginAttempt(false);
    expect(manager.completeAuthorizedFarmer("farmer-b@pond.test")).toEqual({
      rememberLogin: false,
      lastLoginEmail: null,
    });
    expect(JSON.parse(storage.getItem(LOGIN_PREFERENCE_STORAGE_KEY)!)).toEqual({
      rememberLogin: false,
      lastLoginEmail: null,
    });
  });

  it.each(["wrong password", "device role", "missing profile"])("does not replace Farmer A after %s", () => {
    const storage = createMemoryStorage({ rememberLogin: true, lastLoginEmail: "farmer-a@pond.test" });
    const manager = new LoginPreferenceManager(storage);

    manager.beginLoginAttempt(true);
    manager.cancelLoginAttempt();

    expect(readLoginPreference(storage).lastLoginEmail).toBe("farmer-a@pond.test");
  });

  it("replaces Farmer A only after Farmer B becomes an authorized farmer", () => {
    const storage = createMemoryStorage({ rememberLogin: true, lastLoginEmail: "farmer-a@pond.test" });
    const manager = new LoginPreferenceManager(storage);

    manager.beginLoginAttempt(true);
    manager.completeAuthorizedFarmer("farmer-b@pond.test");

    expect(readLoginPreference(storage).lastLoginEmail).toBe("farmer-b@pond.test");
  });

  it("keeps the remembered farmer through logout and ignores restored-session profile events", () => {
    const storage = createMemoryStorage({ rememberLogin: true, lastLoginEmail: "farmer-a@pond.test" });
    const manager = new LoginPreferenceManager(storage);

    manager.cancelLoginAttempt();
    manager.completeAuthorizedFarmer("restored-session@pond.test");

    expect(manager.getCurrent()).toEqual({ rememberLogin: true, lastLoginEmail: "farmer-a@pond.test" });
    expect(readLoginPreference(storage).lastLoginEmail).toBe("farmer-a@pond.test");
  });

  it("forgets the account without storing credential material", () => {
    const storage = createMemoryStorage({ rememberLogin: true, lastLoginEmail: "farmer-a@pond.test" });
    const manager = new LoginPreferenceManager(storage);

    manager.forget();

    const serialized = storage.getItem(LOGIN_PREFERENCE_STORAGE_KEY)!;
    expect(JSON.parse(serialized)).toEqual({ rememberLogin: false, lastLoginEmail: null });
    expect(serialized).not.toMatch(/password|idToken|refreshToken|credential/i);
  });

  it.each([
    ["vi", "Quên tài khoản này", "Chỉ nên bật trên thiết bị cá nhân."],
    ["en", "Forget this account", "Recommended only on personal devices."],
  ] as const)("initializes a stable, password-manager-friendly remembered form in %s", async (locale, forgetLabel, helper) => {
    await setLocale(locale, null);
    const markup = renderToStaticMarkup(
      <LoginScreen
        emailHint="farmer@pond.test"
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
    expect(markup).toContain('value="farmer@pond.test"');
    expect(markup).toMatch(/<input[^>]*type="password"[^>]*autoComplete="current-password"[^>]*autofocus=""[^>]*value=""/);
    expect(markup).toContain('name="rememberMe"');
    expect(markup).toContain('checked=""');
    expect(markup).toContain(forgetLabel);
    expect(markup).toContain(helper);
  });

  it("initializes an unremembered form with an empty password and email focus", () => {
    const markup = renderToStaticMarkup(
      <LoginScreen
        emailHint=""
        initialRememberMe={false}
        error={null}
        loading={false}
        onLogin={async () => true}
        onForgetRememberedAccount={() => undefined}
      />,
    );

    expect(markup).toMatch(/<input[^>]*type="email"[^>]*autofocus=""[^>]*value=""/);
    expect(markup).toMatch(/<input[^>]*type="password"[^>]*value=""/);
    expect(markup).not.toContain("login-forget-account");
  });
});

function createMemoryStorage(initial?: { rememberLogin: boolean; lastLoginEmail: string | null }): LoginPreferenceStorage {
  const values = new Map<string, string>();
  if (initial) values.set(LOGIN_PREFERENCE_STORAGE_KEY, JSON.stringify(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

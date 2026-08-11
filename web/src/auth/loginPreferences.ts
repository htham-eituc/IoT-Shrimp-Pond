export const LOGIN_PREFERENCE_STORAGE_KEY = "smart-shrimp-pond.login-preference.v1";

export interface LoginPreference {
  rememberLogin: boolean;
  lastLoginEmail: string | null;
}

export interface LoginPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const DEFAULT_LOGIN_PREFERENCE: LoginPreference = {
  rememberLogin: true,
  lastLoginEmail: null,
};

const FORGOTTEN_LOGIN_PREFERENCE: LoginPreference = {
  rememberLogin: false,
  lastLoginEmail: null,
};

export class LoginPreferenceManager {
  private preference: LoginPreference;
  private pendingRememberLogin: boolean | null = null;

  constructor(private readonly storage: LoginPreferenceStorage | null = getLoginPreferenceStorage()) {
    this.preference = readLoginPreference(storage);
  }

  getCurrent(): LoginPreference {
    return { ...this.preference };
  }

  beginLoginAttempt(rememberLogin: boolean): void {
    this.pendingRememberLogin = rememberLogin;
  }

  cancelLoginAttempt(): void {
    this.pendingRememberLogin = null;
  }

  completeAuthorizedFarmer(email: string | null): LoginPreference {
    const rememberLogin = this.pendingRememberLogin;
    this.pendingRememberLogin = null;
    if (rememberLogin === null) return this.getCurrent();
    if (!rememberLogin) return this.forget();

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return this.getCurrent();
    this.preference = {
      rememberLogin: true,
      lastLoginEmail: normalizedEmail,
    };
    writePreference(this.storage, this.preference);
    return this.getCurrent();
  }

  forget(): LoginPreference {
    this.pendingRememberLogin = null;
    this.preference = { ...FORGOTTEN_LOGIN_PREFERENCE };
    writePreference(this.storage, this.preference);
    return this.getCurrent();
  }
}

export function readLoginPreference(
  storage: LoginPreferenceStorage | null = getLoginPreferenceStorage(),
): LoginPreference {
  try {
    const serialized = storage?.getItem(LOGIN_PREFERENCE_STORAGE_KEY);
    if (!serialized) return { ...DEFAULT_LOGIN_PREFERENCE };
    const value: unknown = JSON.parse(serialized);
    if (!isRecord(value) || typeof value.rememberLogin !== "boolean") return { ...FORGOTTEN_LOGIN_PREFERENCE };
    if (!value.rememberLogin) return { ...FORGOTTEN_LOGIN_PREFERENCE };
    const lastLoginEmail = normalizeEmail(value.lastLoginEmail);
    if (!lastLoginEmail) return { ...DEFAULT_LOGIN_PREFERENCE };
    return { rememberLogin: true, lastLoginEmail };
  } catch {
    return { ...FORGOTTEN_LOGIN_PREFERENCE };
  }
}

function writePreference(storage: LoginPreferenceStorage | null, preference: LoginPreference): void {
  try {
    storage?.setItem(LOGIN_PREFERENCE_STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // A denied/quota-limited preference write must not invalidate an authorized session.
  }
}

function getLoginPreferenceStorage(): LoginPreferenceStorage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

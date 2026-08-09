import type { DashboardSession } from "../domain/session";

const STORAGE_KEY = "smart-shrimp-pond.mock-session.v1";
const MOCK_EMAIL = "farmer@example.com";

const MOCK_PROFILE = {
  role: "farmer",
  pondId: "pond-001",
  displayName: "Pond Operator",
} as const;

const MOCK_POND = {
  id: "pond-001",
  name: "Smart Shrimp Pond 001",
  connected: true,
  mode: "automatic",
} as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function getMockEmailHint(): string {
  return MOCK_EMAIL;
}

export function validateMockCredentials(email: string, password: string): boolean {
  return email.trim().toLowerCase() === MOCK_EMAIL && password.trim().length > 0;
}

export function createMockSession(): DashboardSession {
  return {
    profile: { ...MOCK_PROFILE },
    pond: { ...MOCK_POND },
  };
}

export function readStoredSession(storage: StorageLike | undefined): DashboardSession | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DashboardSession>;
    if (!isDashboardSession(parsed)) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function writeStoredSession(storage: StorageLike | undefined, session: DashboardSession): void {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(storage: StorageLike | undefined): void {
  storage?.removeItem(STORAGE_KEY);
}

function isDashboardSession(value: Partial<DashboardSession>): value is DashboardSession {
  return (
    value.profile?.role === "farmer" &&
    value.profile.pondId === "pond-001" &&
    typeof value.profile.displayName === "string" &&
    value.pond?.id === "pond-001" &&
    typeof value.pond.name === "string" &&
    typeof value.pond.connected === "boolean" &&
    (value.pond.mode === "automatic" || value.pond.mode === "manual")
  );
}

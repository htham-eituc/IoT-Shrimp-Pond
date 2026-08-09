import { describe, expect, it } from "vitest";
import {
  clearStoredSession,
  createMockSession,
  readStoredSession,
  validateMockCredentials,
  writeStoredSession,
  type StorageLike,
} from "./mockAuth";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("mock auth", () => {
  it("accepts only the mock farmer email with a non-empty placeholder password", () => {
    expect(validateMockCredentials("farmer@example.com", "placeholder")).toBe(true);
    expect(validateMockCredentials("FARMER@example.com", "placeholder")).toBe(true);
    expect(validateMockCredentials("farmer@example.com", "   ")).toBe(false);
    expect(validateMockCredentials("device@example.com", "placeholder")).toBe(false);
  });

  it("persists only the mock farmer session shape", () => {
    const storage = new MemoryStorage();
    const session = createMockSession();

    writeStoredSession(storage, session);
    expect(readStoredSession(storage)).toEqual(session);

    clearStoredSession(storage);
    expect(readStoredSession(storage)).toBeNull();
  });
});

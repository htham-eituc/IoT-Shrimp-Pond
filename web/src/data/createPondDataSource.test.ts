import { describe, expect, it, vi } from "vitest";
import { MockPondDataSource } from "./MockPondDataSource";
import { FirebasePondDataSource } from "./FirebasePondDataSource";
import { createPondDataSource } from "./createPondDataSource";
import { TEST_FARMER_ACCESS } from "../test/fixtures";

const FIREBASE_ENVIRONMENT = {
  VITE_DATA_MODE: "firebase",
  VITE_FIREBASE_API_KEY: "test-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
  VITE_FIREBASE_DATABASE_URL: "https://test-default-rtdb.firebaseio.com",
  VITE_FIREBASE_PROJECT_ID: "test-project",
  VITE_FIREBASE_STORAGE_BUCKET: "test.firebasestorage.app",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "123456789",
  VITE_FIREBASE_APP_ID: "1:123456789:web:test",
};

describe("PondDataSource application composition", () => {
  it("boots in mock mode by default without Firebase configuration", () => {
    const source = createPondDataSource({}, TEST_FARMER_ACCESS);
    expect(source).toBeInstanceOf(MockPondDataSource);
    if (source instanceof MockPondDataSource) source.dispose();
  });

  it("selects Firebase once and forwards environment configuration", () => {
    const firebaseSource = new MockPondDataSource(TEST_FARMER_ACCESS);
    const createFirebaseSource = vi.fn(() => firebaseSource);

    const source = createPondDataSource(FIREBASE_ENVIRONMENT, TEST_FARMER_ACCESS, { createFirebaseSource });

    expect(source).toBe(firebaseSource);
    expect(createFirebaseSource).toHaveBeenCalledWith(
      {
        apiKey: "test-api-key",
        authDomain: "test.firebaseapp.com",
        databaseURL: "https://test-default-rtdb.firebaseio.com",
        projectId: "test-project",
        storageBucket: "test.firebasestorage.app",
        messagingSenderId: "123456789",
        appId: "1:123456789:web:test",
      },
      TEST_FARMER_ACCESS,
    );
    firebaseSource.dispose();
  });

  it("fails fast when Firebase mode is missing configuration", () => {
    expect(() => createPondDataSource({ VITE_DATA_MODE: "firebase" }, TEST_FARMER_ACCESS)).toThrow("VITE_FIREBASE_API_KEY");
    expect(() => createPondDataSource({ VITE_DATA_MODE: "unknown" }, TEST_FARMER_ACCESS)).toThrow("VITE_DATA_MODE");
  });

  it("does not expose device-owned Firebase writes through the web data source", () => {
    const methods = Object.getOwnPropertyNames(FirebasePondDataSource.prototype);
    expect(methods).not.toContain("updateSensors");
    expect(methods).not.toContain("updateDeviceState");
    expect(methods).not.toContain("updatePondStatus");
    expect(methods).not.toContain("updateConnectionState");
    expect(methods).not.toContain("createAlert");
  });

  it("creates fresh pond state for a later authorized account", async () => {
    const userASource = createPondDataSource({}, TEST_FARMER_ACCESS);
    await userASource.updatePondName("pond-001", "User A private state");
    if (userASource instanceof MockPondDataSource) userASource.dispose();

    const userBSource = createPondDataSource({}, {
      profile: {
        role: "farmer",
        pondId: "pond-001",
        displayName: "User B",
      },
    });
    let userBPondName: string | null = null;
    const unsubscribe = userBSource.subscribePond("pond-001", (pond) => {
      userBPondName = pond?.name ?? null;
    });

    expect(userBPondName).toBe("Smart Shrimp Pond 001");
    unsubscribe();
    if (userBSource instanceof MockPondDataSource) userBSource.dispose();
  });
});

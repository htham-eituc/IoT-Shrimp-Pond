import { describe, expect, it } from "vitest";
import { createMockPondDatabase } from "./mockDatabase";
import {
  parseCommand,
  parseKeyedRecordList,
  parsePondAlert,
  parsePondSettings,
  parsePondState,
  parseTelemetryRecord,
  parseUserProfile,
} from "./firebaseMappers";

describe("Firebase snapshot mappers", () => {
  it("accepts the canonical Realtime Database shape", () => {
    const database = createMockPondDatabase();

    expect(parseUserProfile(database.users["mock-farmer-uid"]).role).toBe("farmer");
    expect(parsePondState(database.ponds["pond-001"]).sensors).toHaveProperty("temperature");
    expect(parsePondSettings(database.settings["pond-001"]).mode).toBe("automatic");
    expect(
      parseKeyedRecordList(database.telemetry["pond-001"], parseTelemetryRecord, "telemetry/pond-001"),
    ).toHaveLength(12);
  });

  it("normalizes RTDB-omitted nullable timestamps", () => {
    expect(parseCommand({
      device: "aerator",
      action: "on",
      source: "manual",
      createdAtMs: 100,
      status: "pending",
    }).processedAtMs).toBeNull();

    expect(parsePondAlert({
      type: "hypoxia",
      severity: "critical",
      status: "active",
      message: "Low oxygen",
      measurements: { do: 3.4 },
      createdAtMs: 100,
    }).resolvedAtMs).toBeNull();
  });

  it("rejects legacy aliases and invalid farmer metadata", () => {
    const database = createMockPondDatabase();
    const pond = structuredClone(database.ponds["pond-001"]) as unknown as Record<string, unknown>;
    const sensors = pond.sensors as Record<string, unknown>;
    sensors.temp = sensors.temperature;
    delete sensors.temperature;

    expect(() => parsePondState(pond)).toThrow("temperature");
    expect(() => parseUserProfile({ role: "admin", pondId: "pond-001", displayName: "Admin" })).toThrow("role");
  });
});

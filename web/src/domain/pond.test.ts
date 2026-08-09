import { describe, expect, it } from "vitest";
import type { Command, PondDatabaseRoot, PondSensors, PondState } from "./pond";
import { createMockPondDatabase } from "../data/mockDatabase";

describe("Firebase domain contract", () => {
  it("uses exact sensor, device, and lifecycle field names", () => {
    const database: PondDatabaseRoot = createMockPondDatabase();
    const pond: PondState = database.ponds["pond-001"];
    const sensors: PondSensors = pond.sensors;

    expect(Object.keys(sensors).sort()).toEqual([
      "do",
      "ec",
      "ph",
      "rain",
      "salinity",
      "temperature",
      "waterLevel",
    ]);
    expect(Object.keys(pond.devices).sort()).toEqual([
      "aerator",
      "buzzer",
      "dilutionPump",
      "drainagePump",
      "feeder",
      "warningBeacon",
    ]);
    expect(pond.status).toBe("normal");
    expect(database.settings["pond-001"].mode).toBe("automatic");
  });

  it("does not put legacy aliases into persisted mock objects", () => {
    const database = createMockPondDatabase();
    const serialized = JSON.stringify(database);

    expect(serialized).not.toContain("\"temp\"");
    expect(serialized).not.toContain("\"level\"");
    expect(serialized).not.toContain("\"pumpDrain\"");
    expect(serialized).not.toContain("\"pumpIntake\"");
  });

  it("supports all required command statuses", () => {
    const statuses = ["pending", "completed", "failed"] satisfies Array<Command["status"]>;
    expect(statuses).toEqual(["pending", "completed", "failed"]);
  });
});

import { describe, expect, it } from "vitest";
import { MockPondDataSource } from "./MockPondDataSource";
import { MOCK_NOW_MS } from "./mockDatabase";

describe("MockPondDataSource", () => {
  it("signs in as the mock farmer and exposes pond-001", async () => {
    const source = new MockPondDataSource(undefined, () => MOCK_NOW_MS);
    const user = await source.signIn("farmer@example.com", "placeholder");

    expect(user.profile).toEqual({
      role: "farmer",
      pondId: "pond-001",
      displayName: "Pond Operator",
    });
    expect(source.getCurrentUser()).toEqual(user);
  });

  it("subscribes with immutable Firebase-shaped snapshots", async () => {
    const source = new MockPondDataSource(undefined, () => MOCK_NOW_MS);
    await source.signIn("farmer@example.com", "placeholder");

    const snapshots: Array<string | undefined> = [];
    const unsubscribe = source.subscribePond("pond-001", (pond) => {
      snapshots.push(pond?.name);
    });

    await source.updatePondName("pond-001", "North Nursery Pond");
    unsubscribe();
    await source.updatePondName("pond-001", "South Nursery Pond");

    expect(snapshots).toEqual(["Smart Shrimp Pond 001", "North Nursery Pond"]);
  });

  it("allows settings changes without touching device-owned pond state", async () => {
    const source = new MockPondDataSource(undefined, () => MOCK_NOW_MS);
    await source.signIn("farmer@example.com", "placeholder");
    const before = source.getDatabaseSnapshot().ponds["pond-001"];

    const settings = await source.updateSettings("pond-001", {
      mode: "manual",
      thresholds: {
        do: {
          hypoxia: 4.2,
        },
      },
    });
    const after = source.getDatabaseSnapshot().ponds["pond-001"];

    expect(settings.mode).toBe("manual");
    expect(settings.thresholds.do.hypoxia).toBe(4.2);
    expect(after.sensors).toEqual(before.sensors);
    expect(after.devices).toEqual(before.devices);
    expect(after.status).toBe(before.status);
    expect(after.connected).toBe(before.connected);
  });

  it("creates manual commands without mutating confirmed device state", async () => {
    const source = new MockPondDataSource(undefined, () => MOCK_NOW_MS);
    await source.signIn("farmer@example.com", "placeholder");

    const beforeDevices = source.getDatabaseSnapshot().ponds["pond-001"].devices;
    const command = await source.createCommand("pond-001", {
      device: "aerator",
      action: "on",
      createdAtMs: MOCK_NOW_MS,
    });
    const snapshot = source.getDatabaseSnapshot();

    expect(command.id).toBe("cmd-001");
    expect(command.value).toEqual({
      device: "aerator",
      action: "on",
      source: "manual",
      createdAtMs: MOCK_NOW_MS,
      status: "pending",
      processedAtMs: null,
    });
    expect(snapshot.commands["pond-001"]["cmd-001"]).toEqual(command.value);
    expect(snapshot.ponds["pond-001"].devices).toEqual(beforeDevices);
  });

  it("queries telemetry by timestamp and limit", async () => {
    const source = new MockPondDataSource(undefined, () => MOCK_NOW_MS);
    await source.signIn("farmer@example.com", "placeholder");

    const records = await source.getTelemetry("pond-001", { limit: 3, endAtMs: MOCK_NOW_MS });

    expect(records).toHaveLength(3);
    expect(records.map((record) => record.value.timestampMs)).toEqual([
      MOCK_NOW_MS - 600_000,
      MOCK_NOW_MS - 300_000,
      MOCK_NOW_MS,
    ]);
    expect(records[0].value).toHaveProperty("temperature");
    expect(records[0].value).toHaveProperty("waterLevel");
    expect(records[0].value).toHaveProperty("salinity");
  });

  it("does not expose environmental alert creation through the web data source", () => {
    const source = new MockPondDataSource();
    expect("createAlert" in source).toBe(false);
    expect("updatePondStatus" in source).toBe(false);
    expect("updateDeviceState" in source).toBe(false);
    expect("updateSensors" in source).toBe(false);
  });
});

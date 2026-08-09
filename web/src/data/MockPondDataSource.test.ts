import { afterEach, describe, expect, it, vi } from "vitest";
import { MockPondDataSource } from "./MockPondDataSource";
import { MOCK_NOW_MS } from "./mockDatabase";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("MockPondDataSource", () => {
  it("restores an in-memory authenticated session through the shared interface", async () => {
    const source = new MockPondDataSource(undefined, () => MOCK_NOW_MS);
    expect(await source.restoreSession()).toBeNull();

    const signedIn = await source.signIn("farmer@example.com", "placeholder");
    expect(await source.restoreSession()).toEqual(signedIn);
    source.dispose();
  });

  it("restores mock authentication predictably across fresh browser data-source instances", async () => {
    const values = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } as unknown as Storage;
    vi.stubGlobal("window", { localStorage });

    const firstSource = new MockPondDataSource(undefined, () => MOCK_NOW_MS);
    await firstSource.signIn("farmer@example.com", "placeholder");

    const restoredSource = new MockPondDataSource(undefined, () => MOCK_NOW_MS);
    expect((await restoredSource.restoreSession())?.profile).toEqual({
      role: "farmer",
      pondId: "pond-001",
      displayName: "Pond Operator",
    });

    await restoredSource.signOut();
    const signedOutSource = new MockPondDataSource(undefined, () => MOCK_NOW_MS);
    expect(await signedOutSource.restoreSession()).toBeNull();
    firstSource.dispose();
    restoredSource.dispose();
    signedOutSource.dispose();
  });

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
    vi.useFakeTimers();
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
    source.dispose();
  });

  it("mock IoT controller completes pending commands after a device delay", async () => {
    vi.useFakeTimers();
    let nowMs = MOCK_NOW_MS;
    const source = new MockPondDataSource(undefined, () => nowMs);
    await source.signIn("farmer@example.com", "placeholder");

    const command = await source.createCommand("pond-001", {
      device: "aerator",
      action: "on",
      createdAtMs: nowMs,
    });
    expect(source.getDatabaseSnapshot().ponds["pond-001"].devices.aerator).toBe(false);
    expect(source.getDatabaseSnapshot().commands["pond-001"][command.id].status).toBe("pending");

    nowMs += 349;
    await vi.advanceTimersByTimeAsync(349);
    expect(source.getDatabaseSnapshot().ponds["pond-001"].devices.aerator).toBe(false);

    nowMs += 1;
    await vi.advanceTimersByTimeAsync(1);
    const snapshot = source.getDatabaseSnapshot();

    expect(snapshot.ponds["pond-001"].devices.aerator).toBe(true);
    expect(snapshot.commands["pond-001"][command.id].status).toBe("completed");
    expect(snapshot.commands["pond-001"][command.id].processedAtMs).toBe(MOCK_NOW_MS + 350);
    expect(Object.values(snapshot.events["pond-001"])).toContainEqual({
      type: "device_action",
      source: "manual",
      device: "aerator",
      action: "on",
      reason: `manual_command:${command.id}`,
      createdAtMs: MOCK_NOW_MS + 350,
    });
    source.dispose();
  });

  it("does not let automatic scenario actions overwrite confirmed devices in manual mode", async () => {
    vi.useFakeTimers();
    let nowMs = MOCK_NOW_MS;
    const source = new MockPondDataSource(undefined, () => nowMs);
    await source.signIn("farmer@example.com", "placeholder");
    await source.updateSettings("pond-001", { mode: "manual" });

    await source.createCommand("pond-001", {
      device: "aerator",
      action: "on",
      createdAtMs: nowMs,
    });
    nowMs += 350;
    await vi.advanceTimersByTimeAsync(350);
    expect(source.getDatabaseSnapshot().ponds["pond-001"].devices.aerator).toBe(true);

    source.setDemoScenario("pond-001", "normal");
    nowMs += 1_000;
    await vi.advanceTimersByTimeAsync(1_000);

    expect(source.getDatabaseSnapshot().ponds["pond-001"].devices.aerator).toBe(true);
    source.dispose();
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

  it("runs the hypoxia scenario with device-owned status, alert, events, and telemetry", async () => {
    vi.useFakeTimers();
    let nowMs = MOCK_NOW_MS;
    const source = new MockPondDataSource(undefined, () => nowMs);
    await source.signIn("farmer@example.com", "placeholder");

    source.setDemoScenario("pond-001", "hypoxia");
    expect(source.getDatabaseSnapshot().ponds["pond-001"].status).toBe("warning");

    nowMs += 1_000;
    await vi.advanceTimersByTimeAsync(1_000);
    const criticalSnapshot = source.getDatabaseSnapshot();

    expect(criticalSnapshot.ponds["pond-001"].sensors.do).toBeLessThan(4);
    expect(criticalSnapshot.ponds["pond-001"].status).toBe("critical");
    expect(criticalSnapshot.ponds["pond-001"].devices).toMatchObject({
      aerator: true,
      feeder: false,
      buzzer: true,
      warningBeacon: true,
    });
    expect(Object.values(criticalSnapshot.alerts["pond-001"])).toContainEqual(
      expect.objectContaining({
        type: "hypoxia",
        severity: "critical",
        status: "active",
        resolvedAtMs: null,
      }),
    );

    nowMs += 4_000;
    await vi.advanceTimersByTimeAsync(4_000);
    const telemetry = await source.getTelemetry("pond-001", { limit: 1 });
    expect(telemetry[0].value).toMatchObject({
      timestampMs: MOCK_NOW_MS + 5_000,
      rain: false,
    });
    expect(telemetry[0].value.do).toBeLessThan(4);
    source.dispose();
  });

  it("runs rain overflow with boolean rain and internal-only rain intensity", async () => {
    vi.useFakeTimers();
    const source = new MockPondDataSource(undefined, () => MOCK_NOW_MS);
    await source.signIn("farmer@example.com", "placeholder");

    source.setDemoScenario("pond-001", "rain_overflow");
    const snapshot = source.getDatabaseSnapshot();

    expect(snapshot.ponds["pond-001"].sensors.rain).toBe(true);
    expect(snapshot.ponds["pond-001"].sensors).not.toHaveProperty("rainIntensityMmPerHour");
    expect(snapshot.ponds["pond-001"].sensors.waterLevel).toBeGreaterThan(90);
    expect(snapshot.ponds["pond-001"].devices.drainagePump).toBe(true);
    expect(snapshot.ponds["pond-001"].devices.aerator).toBe(true);
    expect(Object.values(snapshot.alerts["pond-001"])).toContainEqual(
      expect.objectContaining({ type: "rain_overflow", status: "active" }),
    );
    expect(source.getDemoScenarioState().rainIntensityMmPerHour).toBeGreaterThan(0);
    source.dispose();
  });

  it("publishes scenario changes through PondDataSource pond subscriptions", async () => {
    vi.useFakeTimers();
    const source = new MockPondDataSource(undefined, () => MOCK_NOW_MS);
    await source.signIn("farmer@example.com", "placeholder");

    const observed = new Array<{ rain: boolean; drainagePump: boolean; status: string }>();
    const unsubscribe = source.subscribePond("pond-001", (pond) => {
      if (!pond) return;
      observed.push({
        rain: pond.sensors.rain,
        drainagePump: pond.devices.drainagePump,
        status: pond.status,
      });
    });

    source.setDemoScenario("pond-001", "rain_overflow");

    expect(observed).toContainEqual({
      rain: true,
      drainagePump: true,
      status: "critical",
    });
    unsubscribe();
    source.dispose();
  });

  it("runs heat salinity and uses the boolean feeder state for reduced feeding behavior", async () => {
    vi.useFakeTimers();
    const source = new MockPondDataSource(undefined, () => MOCK_NOW_MS);
    await source.signIn("farmer@example.com", "placeholder");

    source.setDemoScenario("pond-001", "heat_salinity");
    const snapshot = source.getDatabaseSnapshot();

    expect(snapshot.ponds["pond-001"].sensors.temperature).toBeGreaterThan(
      snapshot.settings["pond-001"].thresholds.temperature.warningHigh,
    );
    expect(snapshot.ponds["pond-001"].sensors.salinity).toBeGreaterThan(
      snapshot.settings["pond-001"].thresholds.salinity.warningHigh,
    );
    expect(snapshot.ponds["pond-001"].devices.dilutionPump).toBe(true);
    expect(snapshot.ponds["pond-001"].devices.feeder).toBe(false);
    expect(Object.values(snapshot.alerts["pond-001"])).toContainEqual(
      expect.objectContaining({ type: "heat_salinity", severity: "warning", status: "active" }),
    );
    source.dispose();
  });

  it("recovers active scenario alerts when normal conditions return", async () => {
    vi.useFakeTimers();
    let nowMs = MOCK_NOW_MS;
    const source = new MockPondDataSource(undefined, () => nowMs);
    await source.signIn("farmer@example.com", "placeholder");

    source.setDemoScenario("pond-001", "hypoxia");
    nowMs += 1_000;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(Object.values(source.getDatabaseSnapshot().alerts["pond-001"]).some((alert) => alert.status === "active")).toBe(true);

    nowMs += 1_000;
    source.setDemoScenario("pond-001", "normal");
    const snapshot = source.getDatabaseSnapshot();

    expect(snapshot.ponds["pond-001"].sensors.do).toBeGreaterThan(5.5);
    expect(snapshot.ponds["pond-001"].status).toBe("normal");
    expect(Object.values(snapshot.alerts["pond-001"]).every((alert) => alert.status === "resolved")).toBe(true);
    expect(Object.values(snapshot.events["pond-001"])).toContainEqual(
      expect.objectContaining({ type: "workflow_resolved", source: "automatic" }),
    );
    source.dispose();
  });
});

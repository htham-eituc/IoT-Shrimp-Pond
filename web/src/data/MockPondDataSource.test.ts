import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandRecord, PondState } from "../domain";
import {
  DEFAULT_MOCK_POND_ID,
  MockPondDataSource,
} from "./MockPondDataSource";

afterEach(() => {
  vi.useRealTimers();
});

describe("MockPondDataSource", () => {
  it("starts with an authenticated farmer and representative telemetry history", async () => {
    const source = new MockPondDataSource({ now: () => 2_000_000_000_000 });

    expect(source.getCurrentSession()?.profile).toMatchObject({
      role: "farmer",
      pondId: DEFAULT_MOCK_POND_ID,
    });

    const telemetry = await source.loadTelemetry(DEFAULT_MOCK_POND_ID);
    expect(telemetry).toHaveLength(5);
    expect(telemetry.some((sample) => sample.do >= 5)).toBe(true);
    expect(telemetry.some((sample) => sample.do < 5 && sample.do >= 4)).toBe(true);
    expect(telemetry.some((sample) => sample.do < 4)).toBe(true);
    expect(telemetry.map((sample) => sample.timestampMs)).toEqual(
      [...telemetry.map((sample) => sample.timestampMs)].sort((left, right) => left - right),
    );

    source.dispose();
  });

  it("emits a pending command before simulated device feedback completes it", async () => {
    vi.useFakeTimers();
    let nowMs = 2_000_000_000_000;
    const source = new MockPondDataSource({
      now: () => nowMs,
      commandProcessingDelayMs: 500,
    });
    const commandSnapshots: Array<readonly CommandRecord[]> = [];
    const pondSnapshots: Array<PondState | null> = [];
    source.subscribeCommands(DEFAULT_MOCK_POND_ID, (commands) => {
      commandSnapshots.push(commands);
    });
    source.subscribePond(DEFAULT_MOCK_POND_ID, (pond) => {
      pondSnapshots.push(pond);
    });

    const created = await source.createManualCommand(DEFAULT_MOCK_POND_ID, {
      device: "aerator",
      action: "on",
    });

    expect(created).toMatchObject({ status: "pending", processedAtMs: null });
    expect(commandSnapshots.at(-1)?.find(({ id }) => id === created.id)?.status).toBe(
      "pending",
    );
    expect(pondSnapshots.at(-1)?.devices.aerator).toBe(false);

    nowMs += 500;
    await vi.advanceTimersByTimeAsync(500);

    expect(pondSnapshots.at(-1)?.devices.aerator).toBe(true);
    expect(commandSnapshots.at(-1)?.find(({ id }) => id === created.id)).toMatchObject({
      status: "completed",
      processedAtMs: nowMs,
    });
    expect(
      Object.values(source.getDatabaseSnapshot().events[DEFAULT_MOCK_POND_ID]).some(
        (event) =>
          event.type === "device_action" &&
          event.source === "manual" &&
          event.device === "aerator" &&
          event.action === "on",
      ),
    ).toBe(true);

    source.dispose();
  });

  it("returns defensive snapshots instead of exposing mutable mock internals", () => {
    const source = new MockPondDataSource();
    const first = source.getDatabaseSnapshot();
    first.ponds[DEFAULT_MOCK_POND_ID] = {
      ...first.ponds[DEFAULT_MOCK_POND_ID],
      name: "Changed outside the data source",
    };

    expect(source.getDatabaseSnapshot().ponds[DEFAULT_MOCK_POND_ID]?.name).toBe(
      "Smart Shrimp Pond 001",
    );
    source.dispose();
  });
});

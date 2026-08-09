import { describe, expect, it, vi } from "vitest";
import type { Command, KeyedRecord, PondSettings } from "../domain";
import { createMockPondDatabase, MOCK_NOW_MS } from "../data";
import {
  hasPendingCommand,
  latestCommandForDevice,
  requestManualDeviceCommand,
  updateOperatingMode,
} from "./deviceControl";

const completedCommand: KeyedRecord<Command> = {
  id: "cmd-old",
  value: {
    device: "aerator",
    action: "off",
    source: "manual",
    createdAtMs: MOCK_NOW_MS - 1_000,
    status: "completed",
    processedAtMs: MOCK_NOW_MS - 900,
  },
};

describe("web device control boundary", () => {
  it("creates the exact manual command request without access to actual actuator state", async () => {
    let confirmedAeratorState = false;
    const created: KeyedRecord<Command> = {
      id: "cmd-new",
      value: {
        device: "aerator",
        action: "on",
        source: "manual",
        createdAtMs: MOCK_NOW_MS,
        status: "pending",
        processedAtMs: null,
      },
    };
    const createCommand = vi.fn(async () => created);

    const result = await requestManualDeviceCommand({
      dataSource: { createCommand },
      pondId: "pond-001",
      mode: "manual",
      device: "aerator",
      action: "on",
      commands: [completedCommand],
      now: () => MOCK_NOW_MS,
    });

    expect(createCommand).toHaveBeenCalledWith("pond-001", {
      device: "aerator",
      action: "on",
      createdAtMs: MOCK_NOW_MS,
    });
    expect(result).toEqual(created);
    expect(confirmedAeratorState).toBe(false);
    confirmedAeratorState = result.value.status === "completed";
    expect(confirmedAeratorState).toBe(false);
  });

  it("rejects automatic-mode and duplicate pending requests before writing", async () => {
    const createCommand = vi.fn(async () => completedCommand);
    const pendingCommand: KeyedRecord<Command> = {
      ...completedCommand,
      id: "cmd-pending",
      value: {
        ...completedCommand.value,
        createdAtMs: MOCK_NOW_MS,
        status: "pending",
        processedAtMs: null,
      },
    };

    await expect(
      requestManualDeviceCommand({
        dataSource: { createCommand },
        pondId: "pond-001",
        mode: "automatic",
        device: "aerator",
        action: "on",
        commands: [],
      }),
    ).rejects.toThrow("manual mode");

    await expect(
      requestManualDeviceCommand({
        dataSource: { createCommand },
        pondId: "pond-001",
        mode: "manual",
        device: "aerator",
        action: "on",
        commands: [pendingCommand],
      }),
    ).rejects.toThrow("already pending");

    expect(createCommand).not.toHaveBeenCalled();
    expect(hasPendingCommand([pendingCommand], "aerator")).toBe(true);
    expect(latestCommandForDevice([completedCommand, pendingCommand], "aerator")).toEqual(pendingCommand);
  });

  it("writes operating mode only through the settings path abstraction", async () => {
    const settings = createMockPondDatabase().settings["pond-001"];
    const manualSettings: PondSettings = { ...settings, mode: "manual" };
    const updateSettings = vi.fn(async () => manualSettings);

    const result = await updateOperatingMode({ updateSettings }, "pond-001", "manual");

    expect(updateSettings).toHaveBeenCalledWith("pond-001", { mode: "manual" });
    expect(result.mode).toBe("manual");
  });
});

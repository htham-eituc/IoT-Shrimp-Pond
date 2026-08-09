import { describe, expect, it } from "vitest";
import { DEFAULT_STALE_AFTER_MS, getConnectionPresentation } from "./connection";

describe("connection presentation", () => {
  it("keeps explicit disconnection separate from pond severity", () => {
    expect(getConnectionPresentation(false, 1_000, 2_000)).toEqual({
      state: "offline",
      label: "Offline",
      tone: "offline",
    });
  });

  it("marks a connected controller stale after the heartbeat window", () => {
    expect(getConnectionPresentation(true, 1_000, 1_000 + DEFAULT_STALE_AFTER_MS)).toMatchObject({ state: "online" });
    expect(getConnectionPresentation(true, 1_000, 1_001 + DEFAULT_STALE_AFTER_MS)).toEqual({
      state: "stale",
      label: "Stale",
      tone: "warning",
    });
  });
});

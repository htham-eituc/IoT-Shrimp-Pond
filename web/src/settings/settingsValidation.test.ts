import { describe, expect, it } from "vitest";
import { createMockPondDatabase } from "../data";
import { validatePondSettings } from "./settingsValidation";

describe("settings contract validation", () => {
  it("accepts the canonical Firebase-shaped settings", () => {
    const settings = createMockPondDatabase().settings["pond-001"];
    expect(validatePondSettings(settings)).toEqual({});
  });

  it("rejects invalid ranges and dissolved oxygen ordering by protocol path", () => {
    const settings = createMockPondDatabase().settings["pond-001"];
    settings.thresholds.ph.normalMin = 9;
    settings.thresholds.ph.normalMax = 8;
    settings.thresholds.do.critical = 4.5;
    settings.thresholds.do.hypoxia = 4;
    settings.thresholds.waterLevel.warningHigh = 101;

    const errors = validatePondSettings(settings);

    expect(errors).toHaveProperty("thresholds.ph.normalMax");
    expect(errors).toHaveProperty("thresholds.do.critical");
    expect(errors).toHaveProperty("thresholds.waterLevel.warningHigh");
    expect(errors).not.toHaveProperty("thresholds.rain");
  });

  it("rejects negative trigger durations", () => {
    const settings = createMockPondDatabase().settings["pond-001"];
    settings.thresholds.do.triggerDurationSec = -1;
    settings.thresholds.waterLevel.overflowTriggerDurationSec = -2;

    const errors = validatePondSettings(settings);

    expect(errors).toHaveProperty("thresholds.do.triggerDurationSec");
    expect(errors).toHaveProperty("thresholds.waterLevel.overflowTriggerDurationSec");
  });
});

import { describe, expect, it } from "vitest";
import { createDefaultMockDatabase, DEFAULT_MOCK_POND_ID } from "../data";
import type { PondSensors } from "../domain";
import { getSensorRangeLabel, getSensorTone } from "./sensorStatus";

function fixtures() {
  const database = createDefaultMockDatabase(2_000_000_000_000);
  return {
    sensors: database.ponds[DEFAULT_MOCK_POND_ID].sensors,
    settings: database.settings[DEFAULT_MOCK_POND_ID],
  };
}

describe("sensor status presentation", () => {
  it("uses the documented DO thresholds without changing pond status", () => {
    const { sensors, settings } = fixtures();

    expect(
      getSensorTone("do", { ...sensors, do: 5.5 }, settings, []),
    ).toBe("normal");
    expect(
      getSensorTone("do", { ...sensors, do: 4.5 }, settings, []),
    ).toBe("warning");
    expect(
      getSensorTone("do", { ...sensors, do: 3.7 }, settings, []),
    ).toBe("critical");
  });

  it("treats rain as a boolean state and EC as an unthresholded live reading", () => {
    const { sensors, settings } = fixtures();

    expect(
      getSensorTone("rain", { ...sensors, rain: false }, settings, []),
    ).toBe("normal");
    expect(
      getSensorTone("rain", { ...sensors, rain: true }, settings, []),
    ).toBe("warning");
    expect(getSensorTone("ec", sensors, settings, [])).toBe("info");
    expect(getSensorRangeLabel("ec", settings)).toBe("Raw conductivity reading");
  });

  it("shows the rain-overflow combination as critical without writing it back", () => {
    const { sensors, settings } = fixtures();
    const overflow: PondSensors = {
      ...sensors,
      rain: true,
      waterLevel: settings.thresholds.waterLevel.warningHigh + 1,
    };

    expect(getSensorTone("waterLevel", overflow, settings, [])).toBe("critical");
  });
});

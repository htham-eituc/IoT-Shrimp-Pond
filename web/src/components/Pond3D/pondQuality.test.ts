import { describe, expect, it } from "vitest";
import { selectPond3DQuality } from "./pondQuality";

describe("adaptive pond 3D quality", () => {
  it("uses low quality for reduced motion, compact screens, or constrained devices", () => {
    expect(selectPond3DQuality({ reducedMotion: true, viewportWidth: 1920, deviceMemoryGb: 16 })).toBe("low");
    expect(selectPond3DQuality({ reducedMotion: false, viewportWidth: 768, deviceMemoryGb: 16 })).toBe("low");
    expect(selectPond3DQuality({ reducedMotion: false, viewportWidth: 1920, deviceMemoryGb: 4 })).toBe("low");
  });

  it("uses balanced quality for constrained desktop layouts and high quality for capable wide screens", () => {
    expect(selectPond3DQuality({ reducedMotion: false, viewportWidth: 1366, deviceMemoryGb: 8 })).toBe("balanced");
    expect(selectPond3DQuality({ reducedMotion: false, viewportWidth: 1536, deviceMemoryGb: 8 })).toBe("high");
  });
});

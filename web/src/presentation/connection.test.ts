import { describe, expect, it } from "vitest";
import i18n from "../i18n";
import { DEFAULT_STALE_AFTER_MS, getConnectionPresentation } from "./connection";

describe("connection presentation", () => {
  it("keeps explicit disconnection separate from pond severity", () => {
    expect(getConnectionPresentation(false, 1_000, 2_000)).toEqual({
      state: "offline",
      tone: "offline",
    });
  });

  it("marks a connected controller stale after the heartbeat window", () => {
    expect(getConnectionPresentation(true, 1_000, 1_000 + DEFAULT_STALE_AFTER_MS)).toMatchObject({ state: "online" });
    expect(getConnectionPresentation(true, 1_000, 1_001 + DEFAULT_STALE_AFTER_MS)).toEqual({
      state: "stale",
      tone: "warning",
    });
  });

  it("uses freshness wording that does not over-promise connectivity", () => {
    expect(i18n.getFixedT("en", "common")("connection.online")).toBe("Live");
    expect(i18n.getFixedT("en", "common")("connection.stale")).toBe("Data delayed");
    expect(i18n.getFixedT("vi", "common")("connection.online")).toBe("Đang cập nhật");
    expect(i18n.getFixedT("vi", "common")("connection.stale")).toBe("Dữ liệu chậm");
  });
});

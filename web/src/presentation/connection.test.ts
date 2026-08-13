import { describe, expect, it } from "vitest";
import i18n from "../i18n";
import { getConnectionPresentation } from "./connection";

describe("connection presentation", () => {
  it("keeps explicit disconnection separate from pond severity", () => {
    expect(getConnectionPresentation(false)).toEqual({
      state: "offline",
      tone: "offline",
    });
  });

  it("presents a connected controller as live", () => {
    expect(getConnectionPresentation(true)).toEqual({
      state: "online",
      tone: "normal",
    });
  });

  it("uses live wording for connected controllers", () => {
    expect(i18n.getFixedT("en", "common")("connection.online")).toBe("Live");
    expect(i18n.getFixedT("vi", "common")("connection.online")).toBe("Đang cập nhật");
  });
});

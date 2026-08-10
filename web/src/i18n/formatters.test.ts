import { describe, expect, it } from "vitest";
import { formatDate, formatNumber, formatPercentage, formatRelativeTime, formatTimestamp } from "./formatters";

describe("locale-aware formatters", () => {
  it("formats numbers and percentages for Vietnamese and English", () => {
    expect(formatNumber(1_234.5, "vi", { minimumFractionDigits: 1 })).toBe("1.234,5");
    expect(formatNumber(1_234.5, "en", { minimumFractionDigits: 1 })).toBe("1,234.5");
    expect(formatPercentage(72.5, "vi")).toContain("72,5");
    expect(formatPercentage(72.5, "en")).toContain("72.5");
  });

  it("formats dates, timestamps, and relative time without manual date concatenation", () => {
    const timestamp = Date.UTC(2026, 7, 10, 8, 30, 0);

    expect(formatDate(timestamp, "vi")).toContain("2026");
    expect(formatTimestamp(timestamp, "en")).toContain("2026");
    expect(formatRelativeTime(timestamp - 60_000, "vi", timestamp)).toContain("1 phút");
    expect(formatRelativeTime(timestamp - 60_000, "en", timestamp)).toContain("1 minute ago");
  });
});

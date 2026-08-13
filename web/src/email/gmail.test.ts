import { describe, expect, it } from "vitest";
import type { KeyedRecord, PondAlert } from "../domain";
import { buildCriticalAlertEmail, selectUnsentCriticalAlerts } from "./gmail";

function alert(id: string, severity: PondAlert["severity"], status: PondAlert["status"], createdAtMs: number): KeyedRecord<PondAlert> {
  return { id, value: { type: "hypoxia", severity, status, message: "Low oxygen", measurements: { do: 3.2 }, createdAtMs, resolvedAtMs: null } };
}

describe("Gmail critical alert email", () => {
  it("selects only unsent active critical alerts in chronological order", () => {
    const result = selectUnsentCriticalAlerts([
      alert("new", "critical", "active", 20), alert("warning", "warning", "active", 5),
      alert("old", "critical", "active", 10), alert("resolved", "critical", "resolved", 1),
    ], new Set(["new"]));
    expect(result.map(({ id }) => id)).toEqual(["old"]);
  });

  it("builds the title and content from the alert", () => {
    const email = buildCriticalAlertEmail({
      alert: alert("alert-1", "critical", "active", 1_786_200_100_000),
      pondId: "pond-001", pondName: "North Pond", recipientEmail: "farmer@example.com",
    });
    expect(email.subject).toBe("[CRITICAL] North Pond: Hypoxia");
    expect(email.text).toContain("Content: Low oxygen");
    expect(email.text).toContain("- do: 3.2");
  });
});

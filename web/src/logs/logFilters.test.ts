import { describe, expect, it } from "vitest";
import type { KeyedRecord, PondAlert, PondEvent } from "../domain";
import { filterAlerts, filterEvents } from "./logFilters";

const alerts: Array<KeyedRecord<PondAlert>> = [
  {
    id: "critical-active",
    value: {
      type: "hypoxia",
      severity: "critical",
      status: "active",
      message: "Low oxygen",
      createdAtMs: 2,
      resolvedAtMs: null,
    },
  },
  {
    id: "warning-resolved",
    value: {
      type: "heat_salinity",
      severity: "warning",
      status: "resolved",
      message: "Heat event resolved",
      createdAtMs: 1,
      resolvedAtMs: 3,
    },
  },
];

const events: Array<KeyedRecord<PondEvent>> = [
  { id: "manual", value: { type: "device_action", source: "manual", device: "aerator", action: "on", createdAtMs: 2 } },
  { id: "workflow", value: { type: "workflow_started", source: "automatic", reason: "hypoxia", createdAtMs: 1 } },
];

describe("alert and event filters", () => {
  it("filters environmental alerts by status, severity, and type", () => {
    expect(filterAlerts(alerts, { status: "active", severity: "critical", type: "hypoxia" }).map((item) => item.id)).toEqual([
      "critical-active",
    ]);
    expect(filterAlerts(alerts, { status: "resolved", severity: "all", type: "all" }).map((item) => item.id)).toEqual([
      "warning-resolved",
    ]);
  });

  it("filters system events independently by type and source", () => {
    expect(filterEvents(events, { type: "device_action", source: "manual" }).map((item) => item.id)).toEqual(["manual"]);
    expect(filterEvents(events, { type: "all", source: "automatic" }).map((item) => item.id)).toEqual(["workflow"]);
  });
});

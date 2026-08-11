import { describe, expect, it } from "vitest";
import { createMockPondDatabase, MockPondDataSource, MOCK_NOW_MS } from "../data";
import type { PondState } from "../domain";
import { TEST_FARMER_ACCESS } from "../test/fixtures";
import {
  applyScopedDashboardUpdate,
  createScopedDashboardLoadingState,
  isCurrentDashboardScope,
} from "./usePondDashboard";

describe("dashboard realtime state scoping", () => {
  it("ignores a stale pond update from a previous data source", () => {
    const oldSource = new MockPondDataSource(TEST_FARMER_ACCESS, undefined, () => MOCK_NOW_MS);
    const currentSource = new MockPondDataSource(TEST_FARMER_ACCESS, undefined, () => MOCK_NOW_MS);
    const current = createScopedDashboardLoadingState(currentSource, "pond-001");
    const oldPond = createMockPondDatabase(MOCK_NOW_MS).ponds["pond-001"];
    oldPond.name = "Old source pond";

    const next = applyScopedDashboardUpdate(current, { dataSource: oldSource, pondId: "pond-001" }, { pond: oldPond });

    expect(next).toBe(current);
    expect(next.pond).toBeNull();
    oldSource.dispose();
    currentSource.dispose();
  });

  it("ignores a stale pond update from a previous pond id", () => {
    const source = new MockPondDataSource(TEST_FARMER_ACCESS, undefined, () => MOCK_NOW_MS);
    const current = createScopedDashboardLoadingState(source, "pond-002");
    const oldPond = createMockPondDatabase(MOCK_NOW_MS).ponds["pond-001"];

    expect(isCurrentDashboardScope(current, { dataSource: source, pondId: "pond-001" })).toBe(false);
    expect(applyScopedDashboardUpdate(current, { dataSource: source, pondId: "pond-001" }, { pond: oldPond })).toBe(current);
    source.dispose();
  });

  it("replaces a complete PondState snapshot instead of merging nested sensor or device values", () => {
    const source = new MockPondDataSource(TEST_FARMER_ACCESS, undefined, () => MOCK_NOW_MS);
    const current = createScopedDashboardLoadingState(source, "pond-001");
    const oldPond = createPond("Old", {
      ph: 6.1,
      do: 2.9,
      aerator: true,
    });
    const hydrated = applyScopedDashboardUpdate(current, { dataSource: source, pondId: "pond-001" }, { pond: oldPond });
    const newPond = createPond("New", {
      ph: 8.2,
      do: 6.4,
      aerator: false,
      drainagePump: true,
    });

    const replaced = applyScopedDashboardUpdate(hydrated, { dataSource: source, pondId: "pond-001" }, { pond: newPond });

    expect(replaced.pond).toBe(newPond);
    expect(replaced.pond?.sensors).toEqual(newPond.sensors);
    expect(replaced.pond?.devices).toEqual(newPond.devices);
    expect(replaced.pond?.sensors.ph).toBe(8.2);
    expect(replaced.pond?.devices.aerator).toBe(false);
    expect(replaced.pond?.devices.drainagePump).toBe(true);
    source.dispose();
  });
});

function createPond(
  name: string,
  changes: Partial<PondState["sensors"] & PondState["devices"]>,
): PondState {
  const pond = structuredClone(createMockPondDatabase(MOCK_NOW_MS).ponds["pond-001"]);
  pond.name = name;
  pond.sensors = {
    ...pond.sensors,
    ph: changes.ph ?? pond.sensors.ph,
    do: changes.do ?? pond.sensors.do,
  };
  pond.devices = {
    ...pond.devices,
    aerator: changes.aerator ?? pond.devices.aerator,
    drainagePump: changes.drainagePump ?? pond.devices.drainagePump,
  };
  return pond;
}

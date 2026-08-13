import { describe, expect, it } from "vitest";
import { TEST_FARMER_ACCESS } from "../test/fixtures";
import { MockPondDataSource } from "./MockPondDataSource";

describe("simulation control data source contract", () => {
  it("publishes a control request without inventing device-reported state", async () => {
    const source = new MockPondDataSource(TEST_FARMER_ACCESS, undefined, () => 123_000);
    let latest = null;
    const unsubscribe = source.subscribeSimulation("pond-001", (snapshot) => {
      latest = snapshot;
    });

    const control = await source.requestSimulation("pond-001", "hypoxia");

    expect(control).toMatchObject({
      enabled: true,
      scenario: "hypoxia",
      requestedAtMs: 123_000,
    });
    expect(latest).toMatchObject({
      control,
      state: {
        active: false,
        scenario: "normal",
        requestId: "initial",
      },
    });

    unsubscribe();
    source.dispose();
  });
});

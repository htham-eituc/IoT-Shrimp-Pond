import { describe, expect, it } from "vitest";
import { MockPondDataSource } from "./MockPondDataSource";
import { PondDataSourceError } from "./PondDataSource";
import { createPondDataSource } from "./createPondDataSource";

describe("createPondDataSource", () => {
  it("uses mock data by default when no environment is configured", () => {
    const source = createPondDataSource({ env: {} });
    expect(source).toBeInstanceOf(MockPondDataSource);
    if (source instanceof MockPondDataSource) {
      source.dispose();
    }
  });

  it("fails clearly when Firebase mode is selected without project configuration", () => {
    expect(() =>
      createPondDataSource({
        env: { VITE_POND_DATA_SOURCE: "firebase" },
      }),
    ).toThrowError(PondDataSourceError);
  });

  it("rejects unknown data-source modes", () => {
    expect(() =>
      createPondDataSource({
        env: { VITE_POND_DATA_SOURCE: "direct-sensor-writes" },
      }),
    ).toThrow("VITE_POND_DATA_SOURCE must be either 'mock' or 'firebase'.");
  });
});

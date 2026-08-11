import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createMockPondDatabase, MockPondDataSource } from "../data";
import { TEST_FARMER_ACCESS } from "../test/fixtures";
import { SettingsView } from "./SettingsView";

describe("SettingsView threshold layout semantics", () => {
  it("marks every threshold card with a stable semantic grid section", () => {
    const database = createMockPondDatabase();
    const source = new MockPondDataSource(TEST_FARMER_ACCESS);
    const markup = renderToStaticMarkup(
      <SettingsView
        dataSource={source}
        pondId="pond-001"
        settings={database.settings["pond-001"]}
      />,
    );

    expect(markup).toContain('data-threshold-section="do"');
    expect(markup).toContain('data-threshold-section="waterLevel"');
    expect(markup).toContain('data-threshold-section="ph"');
    expect(markup).toContain('data-threshold-section="temperature"');
    expect(markup).toContain('data-threshold-section="salinity"');
    source.dispose();
  });
});

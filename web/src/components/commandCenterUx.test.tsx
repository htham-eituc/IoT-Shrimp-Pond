import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import type { KeyedRecord, PondAlert } from "../domain";
import { createMockPondDatabase, MockPondDataSource } from "../data";
import { setLocale } from "../i18n";
import { TEST_FARMER_ACCESS } from "../test/fixtures";
import { ActiveAlertsPanel } from "./ActiveAlertsPanel";
import { CompactDeviceControls } from "./CompactDeviceControls";

afterEach(async () => setLocale("vi", null));

describe("command-center UX refinement", () => {
  it("puts critical active alerts before warning alerts", async () => {
    await setLocale("en", null);
    const alerts: Array<KeyedRecord<PondAlert>> = [
      alert("warning", "heat_salinity", 1),
      alert("critical", "hypoxia", 2),
    ];

    const markup = renderToStaticMarkup(<ActiveAlertsPanel alerts={alerts} compact />);

    expect(markup.indexOf("Hypoxia")).toBeLessThan(markup.indexOf("Heat and salinity"));
    expect(markup).toContain("active-alerts--critical");
  });

  it.each([
    ["vi", "Hệ thống đang điều khiển thiết bị tự động."],
    ["en", "Devices are currently controlled automatically."],
  ] as const)("keeps manual command buttons visible and disabled in automatic mode (%s)", async (locale, helper) => {
    await setLocale(locale, null);
    const database = createMockPondDatabase();
    const source = new MockPondDataSource(TEST_FARMER_ACCESS, database);
    const pond = database.ponds["pond-001"];
    const markup = renderToStaticMarkup(
      <CompactDeviceControls
        dataSource={source}
        pondId="pond-001"
        connected
        devices={pond.devices}
        settings={database.settings["pond-001"]}
        commands={[]}
        highlightedDevice={null}
        onOpenDetails={() => undefined}
      />,
    );

    expect(markup).toContain(helper);
    expect((markup.match(/compact-device__action/g) ?? [])).toHaveLength(4);
    expect((markup.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(4);
    source.dispose();
  });
});

function alert(severity: PondAlert["severity"], type: PondAlert["type"], createdAtMs: number): KeyedRecord<PondAlert> {
  return {
    id: `${type}-${createdAtMs}`,
    value: {
      type,
      severity,
      status: "active",
      message: type,
      createdAtMs,
      resolvedAtMs: null,
    },
  };
}

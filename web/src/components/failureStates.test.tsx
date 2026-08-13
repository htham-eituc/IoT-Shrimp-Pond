import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import type { Command, KeyedRecord } from "../domain";
import { createMockPondDatabase, MockPondDataSource } from "../data";
import i18n, { setLocale } from "../i18n";
import { TEST_FARMER_ACCESS } from "../test/fixtures";
import { ActiveAlertsPanel } from "./ActiveAlertsPanel";
import { CommandCenterView } from "./CommandCenterView";
import { CompactDeviceControls } from "./CompactDeviceControls";
import { DeviceControlPanel } from "./DeviceControlPanel";
import { TelemetryHistoryView } from "./TelemetryHistoryView";

afterEach(async () => setLocale("vi", null));

describe("localized operational failure and empty states", () => {
  it.each([
    ["vi", ["Chưa có lịch sử quan trắc", "Không có cảnh báo đang hoạt động", "Điều khiển thủ công không khả dụng", "Chưa yêu cầu lệnh nào"]],
    ["en", ["No telemetry history", "No active alerts", "Manual controls are unavailable", "No command requested"]],
  ] as const)("renders empty, disconnected, and no-command states in %s", async (locale, expected) => {
    await setLocale(locale, null);
    const database = createMockPondDatabase();
    const source = new MockPondDataSource(TEST_FARMER_ACCESS, database);
    const pond = database.ponds["pond-001"];
    const settings = { ...database.settings["pond-001"], mode: "manual" as const };
    const markup = [
      renderToStaticMarkup(<TelemetryHistoryView records={[]} loading={false} />),
      renderToStaticMarkup(<ActiveAlertsPanel alerts={[]} compact />),
      renderToStaticMarkup(<CompactDeviceControls dataSource={source} pondId="pond-001" connected={false} devices={pond.devices} settings={settings} commands={[]} highlightedDevice={null} onOpenDetails={() => undefined} />),
      renderToStaticMarkup(<DeviceControlPanel dataSource={source} pondId="pond-001" connected devices={pond.devices} settings={settings} commands={[]} />),
    ].join("");

    for (const text of expected) expect(markup).toContain(text);
    source.dispose();
  });

  it.each([
    ["vi", "Thất bại"],
    ["en", "Failed"],
  ] as const)("announces failed commands in %s", async (locale, failedLabel) => {
    await setLocale(locale, null);
    const database = createMockPondDatabase();
    const source = new MockPondDataSource(TEST_FARMER_ACCESS, database);
    const failedCommand: KeyedRecord<Command> = {
      id: "cmd-failed",
      value: { device: "aerator", action: "on", source: "manual", createdAtMs: 1, status: "failed", processedAtMs: 2 },
    };
    const markup = renderToStaticMarkup(
      <CompactDeviceControls
        dataSource={source}
        pondId="pond-001"
        connected
        devices={database.ponds["pond-001"].devices}
        settings={{ ...database.settings["pond-001"], mode: "manual" }}
        commands={[failedCommand]}
        highlightedDevice={null}
        onOpenDetails={() => undefined}
      />,
    );

    expect(markup).toContain("role=\"alert\"");
    expect(markup).toContain(failedLabel);
    source.dispose();
  });

  it.each([
    ["vi", "thời điểm cập nhật cuối đã quá 30 giây"],
    ["en", "last-seen timestamp is older than 30 seconds"],
  ] as const)("renders stale telemetry and localized data-source errors in %s", async (locale, staleText) => {
    await setLocale(locale, null);
    const database = createMockPondDatabase();
    const source = new MockPondDataSource(TEST_FARMER_ACCESS, database);
    const markup = renderToStaticMarkup(
      <CommandCenterView
        dataSource={source}
        pondId="pond-001"
        pond={database.ponds["pond-001"]}
        settings={database.settings["pond-001"]}
        alerts={[]}
        commands={[]}
        telemetry={[]}
        connectionState="stale"
        onOpenDetail={() => undefined}
      />,
    );

    expect(markup).toContain(staleText);
    expect(i18n.t("firebaseUnavailable", { ns: "dashboard" })).not.toMatch(/^dashboard[.:]/);
    expect(i18n.t("firebaseUnavailableDescription", { ns: "dashboard", reason: i18n.t("pondSubscribe", { ns: "errors" }) })).not.toMatch(/dashboard[.:]|errors[.:]/);
    source.dispose();
  });
});

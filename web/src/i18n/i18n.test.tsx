import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { createMockSession } from "../auth/mockAuth";
import { AppShell } from "../components/AppShell";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { LoginScreen } from "../components/LoginScreen";
import { AlertsEventsView } from "../components/AlertsEventsView";
import { DeviceControlPanel } from "../components/DeviceControlPanel";
import { PondVisualization } from "../components/PondVisualization";
import { SettingsView } from "../components/SettingsView";
import { TelemetryHistoryView } from "../components/TelemetryHistoryView";
import { MockPondDataSource, createMockPondDatabase } from "../data";
import i18n, { LOCALE_STORAGE_KEY, SUPPORTED_LOCALES, resources, setLocale, translateError, type LocaleStorage, type SupportedLocale } from ".";

afterEach(async () => {
  await setLocale("vi", null);
});

describe("application localization", () => {
  it("renders the primary authenticated and login UI in Vietnamese", async () => {
    await setLocale("vi", null);

    const login = renderToStaticMarkup(
      <LoginScreen emailHint="" error={null} loading={false} onLogin={async () => undefined} />,
    );
    const source = new MockPondDataSource();
    const shell = renderToStaticMarkup(
      <AppShell dataSource={source} session={createMockSession()} onLogout={() => undefined} />,
    );

    expect(login).toContain("Đăng nhập");
    expect(login).toContain("Mật khẩu");
    expect(shell).toContain("Ao hiện tại");
    expect(shell).toContain("Tự động");
    expect(shell).toContain("Đang tải dữ liệu ao");
    expect(`${login}${shell}`).not.toMatch(/(?:common|auth|dashboard|errors):[\w.]+/);
    source.dispose();
  });

  it("renders the primary authenticated and login UI in English", async () => {
    await setLocale("en", null);

    const login = renderToStaticMarkup(
      <LoginScreen emailHint="" error={null} loading={false} onLogin={async () => undefined} />,
    );
    const source = new MockPondDataSource();
    const shell = renderToStaticMarkup(
      <AppShell dataSource={source} session={createMockSession()} onLogout={() => undefined} />,
    );

    expect(login).toContain("Sign in");
    expect(login).toContain("Password");
    expect(shell).toContain("Current pond");
    expect(shell).toContain("Automatic");
    expect(shell).toContain("Loading pond data");
    expect(`${login}${shell}`).not.toMatch(/(?:common|auth|dashboard|errors):[\w.]+/);
    source.dispose();
  });

  it("switches language, updates the selector state, and persists only the UI preference", async () => {
    const storage = createMemoryStorage();

    await setLocale("vi", storage);
    const vietnameseSwitcher = renderToStaticMarkup(<LanguageSwitcher />);
    expect(vietnameseSwitcher).toContain("aria-label=\"Tiếng Việt\"");
    expect(vietnameseSwitcher).toMatch(/aria-pressed="true"[^>]*>VI</);

    await setLocale("en", storage);
    const englishSwitcher = renderToStaticMarkup(<LanguageSwitcher />);

    expect(i18n.resolvedLanguage).toBe("en");
    expect(storage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
    expect(englishSwitcher).toContain("aria-label=\"English\"");
    expect(englishSwitcher).toMatch(/aria-pressed="true"[^>]*>EN</);
    expect(storage.keys()).toEqual([LOCALE_STORAGE_KEY]);
  });

  it("never translates protocol enum values inside Firebase-shaped objects", async () => {
    const database = createMockPondDatabase();
    const originalProtocolValues = {
      mode: database.settings["pond-001"].mode,
      status: database.ponds["pond-001"].status,
      role: database.users["mock-farmer-uid"].role,
      alertType: database.alerts["pond-001"]["alert-heat-001"].type,
      alertStatus: database.alerts["pond-001"]["alert-heat-001"].status,
    };

    await setLocale("vi", null);

    expect(i18n.t("mode.automatic", { ns: "common" })).toBe("Tự động");
    expect(i18n.t("status.normal", { ns: "common" })).toBe("Bình thường");
    expect(originalProtocolValues).toEqual({
      mode: "automatic",
      status: "normal",
      role: "farmer",
      alertType: "heat_salinity",
      alertStatus: "resolved",
    });
  });

  it.each([
    ["vi", ["Chế độ vận hành và thiết bị", "Ngưỡng và tự động hóa", "Dữ liệu chất lượng nước gần đây", "12 bản ghi", "Cảnh báo và sự kiện", "Mực nước"]],
    ["en", ["Operating mode and devices", "Thresholds and automation", "Recent water-quality records", "12 records", "Alerts and events", "Water level"]],
  ] as const)("renders all existing feature areas in %s", async (locale, expectedStrings) => {
    await setLocale(locale as SupportedLocale, null);
    const database = createMockPondDatabase();
    const pond = database.ponds["pond-001"];
    const settings = database.settings["pond-001"];
    const source = new MockPondDataSource(database);
    const records = Object.entries(database.telemetry["pond-001"]).map(([id, value]) => ({ id, value }));
    const alerts = Object.entries(database.alerts["pond-001"]).map(([id, value]) => ({ id, value }));
    const events = Object.entries(database.events["pond-001"]).map(([id, value]) => ({ id, value }));
    const markup = [
      renderToStaticMarkup(<DeviceControlPanel dataSource={source} pondId="pond-001" connected={pond.connected} devices={pond.devices} settings={settings} commands={[]} />),
      renderToStaticMarkup(<SettingsView dataSource={source} pondId="pond-001" settings={settings} />),
      renderToStaticMarkup(<TelemetryHistoryView records={records} loading={false} />),
      renderToStaticMarkup(<AlertsEventsView alerts={alerts} events={events} />),
      renderToStaticMarkup(<PondVisualization pond={pond} />),
    ].join("");

    for (const expected of expectedStrings) expect(markup).toContain(expected);
    expect(markup).not.toMatch(/(?:common|control|history|settings|alerts|events):[\w.]+/);
    source.dispose();
  });

  it("localizes known operational errors without changing their source objects", async () => {
    const reason = new Error("Invalid mock credentials.");

    await setLocale("vi", null);
    expect(translateError(reason, "signIn")).toBe("Thông tin đăng nhập mô phỏng không hợp lệ.");
    await setLocale("en", null);
    expect(translateError(reason, "signIn")).toBe("Invalid mock credentials.");
    expect(reason.message).toBe("Invalid mock credentials.");
  });

  it("keeps Vietnamese and English namespace keys in parity without exposing key placeholders", () => {
    const vietnameseKeys = flattenKeys(resources.vi).sort();
    const englishKeys = flattenKeys(resources.en).sort();

    expect(vietnameseKeys).toEqual(englishKeys);
    expect(SUPPORTED_LOCALES).toEqual(["vi", "en"]);
    for (const locale of ["vi", "en"] as const) {
      for (const namespace of ["common", "auth", "dashboard", "sensors", "devices", "control", "history", "settings", "alerts", "events", "scenarios", "errors"] as const) {
        expect(i18n.getResourceBundle(locale, namespace)).toBeTruthy();
      }
    }
  });

  it("uses locale-correct singular and plural operational labels", async () => {
    await setLocale("en", null);
    expect(i18n.t("records", { ns: "history", count: 1 })).toBe("1 record");
    expect(i18n.t("records", { ns: "history", count: 2 })).toBe("2 records");
    expect(i18n.t("moreActive", { ns: "alerts", count: 1 })).toBe("+1 more active alert");

    await setLocale("vi", null);
    expect(i18n.t("records", { ns: "history", count: 1 })).toBe("1 bản ghi");
    expect(i18n.t("records", { ns: "history", count: 2 })).toBe("2 bản ghi");
  });
});

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}

function createMemoryStorage(): LocaleStorage & { keys(): string[] } {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    keys: () => [...values.keys()],
  };
}

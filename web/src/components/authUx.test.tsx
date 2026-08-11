import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { MockPondDataSource } from "../data";
import { setLocale } from "../i18n";
import { createTestDashboardSession, TEST_FARMER_ACCESS } from "../test/fixtures";
import { AppShell } from "./AppShell";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { LoadingScreen } from "./LoadingScreen";
import { LoginScreen } from "./LoginScreen";
import { UserMenu } from "./UserMenu";
import { getInitials } from "./userMenuModel";

afterEach(async () => {
  await setLocale("vi", null);
});

describe("authentication UX", () => {
  it.each([
    ["vi", "Đang đăng nhập…"],
    ["en", "Signing in…"],
  ] as const)("renders a localized, disabled submitting action in %s", async (locale, label) => {
    await setLocale(locale, null);
    const markup = renderToStaticMarkup(
      <LoginScreen emailHint="operator@example.test" initialRememberMe error={null} loading onLogin={async () => true} onForgetRememberedAccount={() => undefined} />,
    );

    expect(markup).toContain(label);
    expect(markup).toContain("operator@example.test");
    expect(markup).toContain("name=\"email\"");
    expect(markup).toContain("autoComplete=\"username\"");
    expect(markup).toContain("name=\"password\"");
    expect(markup).toContain("autoComplete=\"current-password\"");
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    expect(markup).toContain("spin");
  });

  it("associates a localized login failure with both credential fields", async () => {
    await setLocale("en", null);
    const markup = renderToStaticMarkup(
      <LoginScreen emailHint="operator@example.test" initialRememberMe error="Incorrect email or password." loading={false} onLogin={async () => false} onForgetRememberedAccount={() => undefined} />,
    );

    const describedBy = [...markup.matchAll(/aria-describedby="([^"]+)"/g)].map((match) => match[1]);
    expect(describedBy).toHaveLength(2);
    expect(new Set(describedBy).size).toBe(1);
    expect(markup).toContain(`id="${describedBy[0]}"`);
    expect(markup).toContain("role=\"alert\"");
    expect(markup).toContain("Incorrect email or password.");
  });

  it.each([
    ["vi", "Đang xác thực tài khoản…", "Đang kết nối với ao nuôi…"],
    ["en", "Authenticating account…", "Connecting to pond…"],
  ] as const)("announces compact session-entry states in %s", async (locale, accountText, pondText) => {
    await setLocale(locale, null);
    const accountMarkup = renderToStaticMarkup(<LoadingScreen state="validating-profile" />);
    const source = new MockPondDataSource(TEST_FARMER_ACCESS);
    const pondMarkup = renderToStaticMarkup(
      <AppShell dataSource={source} session={createTestDashboardSession()} showWelcome={false} onLogout={async () => undefined} />,
    );

    expect(accountMarkup).toContain("role=\"status\"");
    expect(accountMarkup).toContain(accountText);
    expect(pondMarkup).toContain(pondText);
    expect(pondMarkup).not.toMatch(/(?:pH|mg\/L|°C)>?\s*0(?:\.0+)?/);
    source.dispose();
  });

  it.each([
    ["vi", "Xin chào, Test Pond Operator", "Dữ liệu ao đang được cập nhật theo thời gian thực."],
    ["en", "Welcome, Test Pond Operator", "Pond data is updating in real time."],
  ] as const)("renders the non-blocking interactive welcome in %s", async (locale, title, description) => {
    await setLocale(locale, null);
    const source = new MockPondDataSource(TEST_FARMER_ACCESS);
    const session = createTestDashboardSession();
    const welcomed = renderToStaticMarkup(
      <AppShell dataSource={source} session={session} showWelcome onLogout={async () => undefined} />,
    );
    const restored = renderToStaticMarkup(
      <AppShell dataSource={source} session={session} showWelcome={false} onLogout={async () => undefined} />,
    );

    expect(welcomed).toContain(title);
    expect(welcomed).toContain(description);
    expect(welcomed).toContain("role=\"status\"");
    expect(restored).not.toContain(title);
    source.dispose();
  });

  it("presents a neutral compact user affordance and an explicit logout dialog", async () => {
    await setLocale("en", null);
    const menu = renderToStaticMarkup(
      <UserMenu displayName="Pond Operator" pondId="pond-001" onSignOutRequest={() => undefined} />,
    );
    const dialog = renderToStaticMarkup(
      <ConfirmationDialog
        title="Sign out?"
        description="Your current session will end. You have unsaved changes."
        confirmLabel="Sign out"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(getInitials("Pond Operator")).toBe("PO");
    expect(getInitials("Nguyễn Hải")).toBe("NH");
    expect(menu).toContain("aria-haspopup=\"menu\"");
    expect(menu).toContain("Pond Operator");
    expect(menu).toContain("pond-001");
    expect(dialog).toContain("role=\"alertdialog\"");
    expect(dialog.indexOf("Cancel")).toBeLessThan(dialog.indexOf("Sign out</button>"));
    expect(dialog).toContain("You have unsaved changes.");
    expect(dialog).not.toContain("type=\"submit\"");
  });
});

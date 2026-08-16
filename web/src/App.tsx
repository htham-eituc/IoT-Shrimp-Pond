import { useEffect, useMemo } from "react";
import { AuthProvider, getAuthSource, resolveAuthenticatedApplicationView } from "./auth";
import { useAuth } from "./auth/useAuth";
import { AppShell } from "./components/AppShell";
import { LoadingScreen } from "./components/LoadingScreen";
import { LoginScreen } from "./components/LoginScreen";
import { createPondDataSource } from "./data";
import type { DashboardSession } from "./domain/session";
import { useTheme } from "./theme";

const authSource = getAuthSource();

export default function App() {
  return (
    <AuthProvider authSource={authSource}>
      <Application />
    </AuthProvider>
  );
}

function Application() {
  const auth = useAuth();
  const { theme, setTheme } = useTheme();
  const view = resolveAuthenticatedApplicationView(auth.status, auth.session !== null);

  if (view === "loading") {
    return <LoadingScreen state={auth.operation} />;
  }

  if (view === "login" || !auth.session) {
    return (
      <LoginScreen
        emailHint={auth.emailHint}
        initialRememberMe={auth.rememberLogin}
        error={auth.error}
        loading={auth.operation === "submitting"}
        onLogin={auth.signIn}
        onForgetRememberedAccount={auth.forgetRememberedAccount}
      />
    );
  }

  return (
    <AuthenticatedApplication
      key={auth.session.user.uid}
      session={auth.session}
      showWelcome={auth.entryKind === "interactive"}
      onLogout={auth.signOut}
      theme={theme}
      onThemeChange={setTheme}
    />
  );
}

function AuthenticatedApplication({
  session,
  showWelcome,
  onLogout,
  theme,
  onThemeChange,
}: {
  session: DashboardSession;
  showWelcome: boolean;
  onLogout(): Promise<void>;
  theme: import("./theme").Theme;
  onThemeChange(theme: import("./theme").Theme): void;
}) {
  const dataSource = useMemo(
    () => createPondDataSource(import.meta.env, {
      profile: {
        role: session.user.role,
        pondId: session.user.pondId,
        displayName: session.user.displayName,
      },
    }),
    [session.user],
  );

  useEffect(() => () => {
    if ("dispose" in dataSource && typeof dataSource.dispose === "function") {
      dataSource.dispose();
    }
  }, [dataSource]);

  return (
    <AppShell
      dataSource={dataSource}
      session={session}
      showWelcome={showWelcome}
      onLogout={onLogout}
      theme={theme}
      onThemeChange={onThemeChange}
    />
  );
}

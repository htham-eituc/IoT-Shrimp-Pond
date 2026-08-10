import { useEffect, useMemo } from "react";
import { AuthProvider, getAuthSource, resolveAuthenticatedApplicationView } from "./auth";
import { useAuth } from "./auth/useAuth";
import { AppShell } from "./components/AppShell";
import { LoadingScreen } from "./components/LoadingScreen";
import { LoginScreen } from "./components/LoginScreen";
import { createPondDataSource } from "./data";
import type { DashboardSession } from "./domain/session";

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
  const view = resolveAuthenticatedApplicationView(auth.status, auth.session !== null);

  if (view === "loading") {
    return <LoadingScreen state={auth.operation} />;
  }

  if (view === "login" || !auth.session) {
    return (
      <LoginScreen
        emailHint={auth.emailHint}
        error={auth.error}
        loading={auth.operation === "submitting"}
        onLogin={auth.signIn}
      />
    );
  }

  return (
    <AuthenticatedApplication
      key={auth.session.user.uid}
      session={auth.session}
      onLogout={auth.signOut}
    />
  );
}

function AuthenticatedApplication({
  session,
  onLogout,
}: {
  session: DashboardSession;
  onLogout(): Promise<void>;
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
      onLogout={() => void onLogout()}
    />
  );
}

import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/useAuth";
import { AppShell } from "./components/AppShell";
import { LoadingScreen } from "./components/LoadingScreen";
import { LoginScreen } from "./components/LoginScreen";
import { getPondDataSource } from "./data";

const dataSource = getPondDataSource();

export default function App() {
  return (
    <AuthProvider dataSource={dataSource}>
      <Application dataSource={dataSource} />
    </AuthProvider>
  );
}

function Application({ dataSource }: { dataSource: ReturnType<typeof getPondDataSource> }) {
  const auth = useAuth();

  if (auth.status === "checking") {
    return <LoadingScreen />;
  }

  if (!auth.session) {
    return (
      <LoginScreen
        emailHint={auth.emailHint}
        error={auth.error}
        loading={auth.status === "signing-in"}
        onLogin={auth.signIn}
      />
    );
  }

  return <AppShell dataSource={dataSource} session={auth.session} onLogout={auth.signOut} />;
}

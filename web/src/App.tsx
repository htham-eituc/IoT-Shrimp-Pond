import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/useAuth";
import { AppShell } from "./components/AppShell";
import { LoadingScreen } from "./components/LoadingScreen";
import { LoginScreen } from "./components/LoginScreen";

export default function App() {
  return (
    <AuthProvider>
      <Application />
    </AuthProvider>
  );
}

function Application() {
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

  return <AppShell session={auth.session} onLogout={auth.signOut} />;
}

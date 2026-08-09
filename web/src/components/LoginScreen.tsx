import { FormEvent, useId, useState } from "react";
import { AlertTriangle, LoaderCircle, LogIn, Waves } from "lucide-react";

interface LoginScreenProps {
  emailHint: string;
  error: string | null;
  loading: boolean;
  onLogin(email: string, password: string): Promise<void>;
}

export function LoginScreen({ emailHint, error, loading, onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState(emailHint);
  const [password, setPassword] = useState("");
  const emailId = useId();
  const passwordId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onLogin(email, password);
    setPassword("");
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            <Waves />
          </span>
          <div>
            <strong>Smart Shrimp Pond</strong>
            <span>Farmer access</span>
          </div>
        </div>

        <div className="auth-copy">
          <span className="eyebrow">Secure dashboard access</span>
          <h1 id="login-title">Sign in</h1>
          <p>Sign in with the farmer account configured for this dashboard environment. Passwords are handled by the active authentication provider and are never stored by the UI.</p>
        </div>

        <form className="login-form" onSubmit={(event) => void submit(event)} noValidate>
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor={passwordId}>Password</label>
          <input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && (
            <p className="form-error" role="alert">
              <AlertTriangle aria-hidden="true" />
              {error}
            </p>
          )}

          <button className="button button--primary" type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
            {loading ? "Signing in" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

import { FormEvent, useId, useState } from "react";
import { AlertTriangle, LoaderCircle, LogIn, Waves } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface LoginScreenProps {
  emailHint: string;
  error: string | null;
  loading: boolean;
  onLogin(email: string, password: string): Promise<void>;
}

export function LoginScreen({ emailHint, error, loading, onLogin }: LoginScreenProps) {
  const { t } = useTranslation(["auth", "common"]);
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
            <strong>{t("brand", { ns: "common" })}</strong>
            <span>{t("farmerAccess")}</span>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="auth-copy">
          <span className="eyebrow">{t("secureAccess")}</span>
          <h1 id="login-title">{t("signIn")}</h1>
          <p>{t("description")}</p>
        </div>

        <form className="login-form" onSubmit={(event) => void submit(event)} noValidate>
          <label htmlFor={emailId}>{t("email")}</label>
          <input
            id={emailId}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor={passwordId}>{t("password")}</label>
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
            {loading ? t("signingIn") : t("signIn")}
          </button>
        </form>
      </section>
    </main>
  );
}

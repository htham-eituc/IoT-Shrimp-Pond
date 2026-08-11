import { FormEvent, useId, useState } from "react";
import { AlertTriangle, Eye, EyeOff, LoaderCircle, LogIn, Waves } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface LoginScreenProps {
  emailHint: string;
  initialRememberMe: boolean;
  error: string | null;
  loading: boolean;
  onLogin(email: string, password: string, rememberMe: boolean): Promise<boolean>;
  onForgetRememberedAccount(): void;
}

export function LoginScreen({
  emailHint,
  initialRememberMe,
  error,
  loading,
  onLogin,
  onForgetRememberedAccount,
}: LoginScreenProps) {
  const { t } = useTranslation(["auth", "common"]);
  const [email, setEmail] = useState(emailHint);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(initialRememberMe);
  const [rememberedAccountVisible, setRememberedAccountVisible] = useState(initialRememberMe && emailHint.length > 0);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const accepted = await onLogin(email, password, rememberMe);
    if (accepted) {
      setPassword("");
    }
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
            name="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
            autoFocus={!rememberedAccountVisible}
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />

          <label htmlFor={passwordId}>{t("password")}</label>
          <div className="login-password-field">
            <input
              id={passwordId}
              type={passwordVisible ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              autoFocus={rememberedAccountVisible}
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            />
            <button
              className="login-password-toggle"
              type="button"
              aria-label={t(passwordVisible ? "hidePassword" : "showPassword")}
              aria-controls={passwordId}
              aria-pressed={passwordVisible}
              onClick={() => setPasswordVisible((visible) => !visible)}
              disabled={loading}
            >
              {passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>

          <label className="login-remember">
            <input
              type="checkbox"
              name="rememberMe"
              checked={rememberMe}
              onChange={(event) => {
                const checked = event.target.checked;
                setRememberMe(checked);
                if (!checked) {
                  setRememberedAccountVisible(false);
                  onForgetRememberedAccount();
                }
              }}
              disabled={loading}
            />
            <span>
              {t("rememberMe")}
              <small>{t("rememberPersonalDevice")}</small>
            </span>
          </label>

          {rememberedAccountVisible && (
            <button
              className="login-forget-account"
              type="button"
              disabled={loading}
              onClick={() => {
                onForgetRememberedAccount();
                setRememberMe(false);
                setRememberedAccountVisible(false);
                setEmail("");
              }}
            >
              {t("forgetRememberedAccount")}
            </button>
          )}

          {error && (
            <p id={errorId} className="form-error" role="alert" aria-live="assertive">
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

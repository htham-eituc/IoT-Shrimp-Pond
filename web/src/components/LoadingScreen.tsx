import { LoaderCircle, Waves } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LoadingScreenProps {
  state?: "idle" | "submitting" | "validating-profile" | "signing-out";
}

export function LoadingScreen({ state = "idle" }: LoadingScreenProps) {
  const { t } = useTranslation("auth");
  return (
    <main className="loading-screen" aria-busy="true">
      <div className="loading-card">
        <span className="brand-mark brand-mark--large" aria-hidden="true">
          <Waves />
        </span>
        <LoaderCircle className="spin" aria-hidden="true" />
        <h1>{t(state === "signing-out" ? "signingOut" : "preparing")}</h1>
        <p>{t(state === "validating-profile" ? "validatingProfile" : state === "signing-out" ? "signingOutDescription" : "checkingSession")}</p>
      </div>
    </main>
  );
}

import { LoaderCircle, Waves } from "lucide-react";
import { useTranslation } from "react-i18next";

export function LoadingScreen() {
  const { t } = useTranslation("auth");
  return (
    <main className="loading-screen" aria-busy="true">
      <div className="loading-card">
        <span className="brand-mark brand-mark--large" aria-hidden="true">
          <Waves />
        </span>
        <LoaderCircle className="spin" aria-hidden="true" />
        <h1>{t("preparing")}</h1>
        <p>{t("checkingSession")}</p>
      </div>
    </main>
  );
}

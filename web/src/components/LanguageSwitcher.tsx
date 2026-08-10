import { useTranslation } from "react-i18next";
import { getActiveLocale, setLocale, type SupportedLocale } from "../i18n";

const OPTIONS: SupportedLocale[] = ["vi", "en"];

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");
  const activeLocale = getActiveLocale(i18n.resolvedLanguage ?? i18n.language);

  return (
    <div className="language-switcher" role="group" aria-label={t("language.label")}>
      {OPTIONS.map((locale) => (
        <button
          key={locale}
          type="button"
          className={locale === activeLocale ? "language-switcher__option language-switcher__option--active" : "language-switcher__option"}
          aria-pressed={locale === activeLocale}
          aria-label={locale === "vi" ? t("language.vietnamese") : t("language.english")}
          onClick={() => void setLocale(locale)}
        >
          {locale === "vi" ? t("language.shortVietnamese") : t("language.shortEnglish")}
        </button>
      ))}
    </div>
  );
}

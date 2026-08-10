import i18n, { type TFunction } from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { vi } from "./locales/vi";

export type SupportedLocale = "vi" | "en";

export const SUPPORTED_LOCALES = ["vi", "en"] as const;
export const LOCALE_STORAGE_KEY = "smart-shrimp-pond.locale.v1";

export interface LocaleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const resources = { vi, en } as const;

const initialLocale = readPersistedLocale(getBrowserStorage()) ?? "vi";

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: "vi",
  supportedLngs: [...SUPPORTED_LOCALES],
  defaultNS: "common",
  ns: Object.keys(en),
  interpolation: { escapeValue: false },
  initAsync: false,
  returnNull: false,
});

updateDocumentLanguage(initialLocale);

export function getActiveLocale(language = i18n.resolvedLanguage ?? i18n.language): SupportedLocale {
  return language.toLowerCase().startsWith("en") ? "en" : "vi";
}

export function readPersistedLocale(storage: LocaleStorage | null): SupportedLocale | null {
  try {
    const value = storage?.getItem(LOCALE_STORAGE_KEY);
    return value === "vi" || value === "en" ? value : null;
  } catch {
    return null;
  }
}

export async function setLocale(locale: SupportedLocale, storage: LocaleStorage | null = getBrowserStorage()): Promise<void> {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Language switching still works when browser storage is unavailable.
  }
  await i18n.changeLanguage(locale);
  updateDocumentLanguage(locale);
}

export function translateError(reason: unknown, fallbackKey: string, t: TFunction = i18n.t): string {
  const message = reason instanceof Error ? reason.message : null;
  const mappedKey = message ? ERROR_MESSAGE_KEYS[message] : undefined;
  if (mappedKey) return t(mappedKey, { ns: "errors" });
  return t(fallbackKey, { ns: "errors" });
}

const ERROR_MESSAGE_KEYS: Readonly<Record<string, string>> = {
  "Invalid mock credentials.": "invalidMockCredentials",
  "Mock farmer profile is unavailable.": "mockProfileUnavailable",
  "No dashboard profile exists for this Firebase account.": "firebaseProfileMissing",
  "This Firebase account is not authorized as a farmer.": "firebaseFarmerUnauthorized",
  "Only farmer accounts can open the dashboard.": "farmerOnly",
  "Sign in before reading pond data.": "signInRequired",
  "This account cannot access the requested pond.": "pondAccessDenied",
  "Manual commands are available only in manual mode.": "manualModeOnly",
  "A command is already pending for this device.": "commandPending",
};

function getBrowserStorage(): LocaleStorage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function updateDocumentLanguage(locale: SupportedLocale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.title = i18n.t("brand", { ns: "common", lng: locale });
  document.querySelector('meta[name="description"]')?.setAttribute(
    "content",
    i18n.t("metaDescription", { ns: "common", lng: locale }),
  );
}

export default i18n;

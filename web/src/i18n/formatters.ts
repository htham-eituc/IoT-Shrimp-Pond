import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getActiveLocale, type SupportedLocale } from ".";

export interface LocaleFormatters {
  locale: SupportedLocale;
  number(value: number, options?: Intl.NumberFormatOptions): string;
  percentage(value: number, options?: Intl.NumberFormatOptions): string;
  date(value: number | Date, options?: Intl.DateTimeFormatOptions): string;
  timestamp(value: number | Date): string;
  shortTimestamp(value: number | Date): string;
  relativeTime(value: number, nowMs?: number): string;
}

const INTL_LOCALES: Record<SupportedLocale, string> = { vi: "vi-VN", en: "en-US" };

export function formatNumber(value: number, locale: SupportedLocale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], options).format(value);
}

export function formatPercentage(value: number, locale: SupportedLocale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: "percent",
    maximumFractionDigits: 1,
    ...options,
  }).format(value / 100);
}

export function formatDate(
  value: number | Date,
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], options).format(value);
}

export function formatTimestamp(value: number | Date, locale: SupportedLocale): string {
  return formatDate(value, locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatShortTimestamp(value: number | Date, locale: SupportedLocale): string {
  return formatDate(value, locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatRelativeTime(value: number, locale: SupportedLocale, nowMs = Date.now()): string {
  const differenceSeconds = Math.round((value - nowMs) / 1_000);
  const absoluteSeconds = Math.abs(differenceSeconds);
  const formatter = new Intl.RelativeTimeFormat(INTL_LOCALES[locale], { numeric: "auto" });

  if (absoluteSeconds < 60) return formatter.format(differenceSeconds, "second");
  const differenceMinutes = Math.round(differenceSeconds / 60);
  if (Math.abs(differenceMinutes) < 60) return formatter.format(differenceMinutes, "minute");
  const differenceHours = Math.round(differenceMinutes / 60);
  if (Math.abs(differenceHours) < 24) return formatter.format(differenceHours, "hour");
  return formatter.format(Math.round(differenceHours / 24), "day");
}

export function useLocaleFormatters(): LocaleFormatters {
  const { i18n } = useTranslation();
  const locale = getActiveLocale(i18n.resolvedLanguage ?? i18n.language);

  return useMemo(() => ({
    locale,
    number: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(value, locale, options),
    percentage: (value: number, options?: Intl.NumberFormatOptions) => formatPercentage(value, locale, options),
    date: (value: number | Date, options?: Intl.DateTimeFormatOptions) => formatDate(value, locale, options),
    timestamp: (value: number | Date) => formatTimestamp(value, locale),
    shortTimestamp: (value: number | Date) => formatShortTimestamp(value, locale),
    relativeTime: (value: number, nowMs?: number) => formatRelativeTime(value, locale, nowMs),
  }), [locale]);
}

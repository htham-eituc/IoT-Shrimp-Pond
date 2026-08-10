import { BellRing, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import type { KeyedRecord, PondAlert } from "../domain";
import { useLocaleFormatters } from "../i18n/formatters";
import { StatusBadge } from "./StatusBadge";

export function ActiveAlertsPanel({ alerts, compact = false, limit, action }: { alerts: Array<KeyedRecord<PondAlert>>; compact?: boolean; limit?: number; action?: ReactNode }) {
  const { t } = useTranslation(["alerts", "common", "sensors"]);
  const formatters = useLocaleFormatters();
  const activeAlerts = alerts
    .filter((alert) => alert.value.status === "active")
    .sort((left, right) => severityPriority(right.value.severity) - severityPriority(left.value.severity));
  const visibleAlerts = limit === undefined ? activeAlerts : activeAlerts.slice(0, limit);
  const hasCriticalAlert = activeAlerts.some((alert) => alert.value.severity === "critical");

  return (
    <section
      className={`panel active-alerts${compact ? " active-alerts--compact" : ""}${hasCriticalAlert ? " active-alerts--critical" : ""}`}
      aria-labelledby="active-alerts-title"
      aria-live={hasCriticalAlert ? "assertive" : "polite"}
    >
      <div className="panel-heading panel-heading--bordered">
        <div>
          <span className="eyebrow">{t("activeEyebrow", { ns: "alerts" })}</span>
          <h2 id="active-alerts-title">{t("controllerWarnings", { ns: "alerts" })}</h2>
        </div>
        {action ?? <BellRing aria-hidden="true" />}
      </div>
      {activeAlerts.length === 0 ? (
        <div className="healthy-empty">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>{t("noneActive", { ns: "alerts" })}</strong>
            <p>{t("noneActiveDescription", { ns: "alerts" })}</p>
          </div>
        </div>
      ) : (
        <ol className="alert-list">
          {visibleAlerts.map(({ id, value }) => (
            <li className={`alert-card alert-card--${value.severity}`} key={id}>
              <div className="alert-card__header">
                <span className="alert-card__type">{alertTypeLabel(value.type, t)}</span>
                <StatusBadge label={t(`status.${value.severity}`, { ns: "common" })} tone={value.severity} />
              </div>
              <p>{alertMessage(value, t)}</p>
              {value.measurements && Object.keys(value.measurements).length > 0 && (
                <dl className="active-alert-measurements">
                  {Object.entries(value.measurements).slice(0, 3).map(([name, measurement]) => (
                    <div key={name}>
                      <dt>{translateMeasurementName(name, t)}</dt>
                      <dd>{formatAlertMeasurement(name, measurement, t, formatters.number, formatters.percentage)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <time dateTime={new Date(value.createdAtMs).toISOString()}>{formatters.shortTimestamp(value.createdAtMs)}</time>
            </li>
          ))}
          {visibleAlerts.length < activeAlerts.length && (
            <li className="active-alerts__more">{t("moreActive", { ns: "alerts", count: activeAlerts.length - visibleAlerts.length })}</li>
          )}
        </ol>
      )}
    </section>
  );
}

function severityPriority(severity: PondAlert["severity"]): number {
  return severity === "critical" ? 2 : severity === "warning" ? 1 : 0;
}

function alertTypeLabel(type: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  return ["hypoxia", "rain_overflow", "heat_salinity"].includes(type)
    ? t(`types.${type}`, { ns: "alerts" })
    : type.replaceAll("_", " ");
}

function alertMessage(alert: PondAlert, t: (key: string, options?: Record<string, unknown>) => string): string {
  return ["hypoxia", "rain_overflow", "heat_salinity"].includes(alert.type)
    ? t(`messages.${alert.type}`, { ns: "alerts" })
    : alert.message;
}

const SENSOR_KEYS = new Set(["ph", "do", "temperature", "waterLevel", "rain", "ec", "salinity"]);

function translateMeasurementName(name: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  return SENSOR_KEYS.has(name) ? t(`${name}.label`, { ns: "sensors" }) : name;
}

function formatAlertMeasurement(
  name: string,
  value: unknown,
  t: (key: string, options?: Record<string, unknown>) => string,
  number: (value: number, options?: Intl.NumberFormatOptions) => string,
  percentage: (value: number, options?: Intl.NumberFormatOptions) => string,
): string {
  if (typeof value === "boolean") return t(`boolean.${value}`, { ns: "common" });
  if (typeof value !== "number") return String(value);
  if (name === "waterLevel") return percentage(value, { maximumFractionDigits: 1 });
  const unit = name === "do" ? " mg/L" : name === "temperature" ? " °C" : name === "salinity" ? " ppt" : "";
  return `${number(value, { maximumFractionDigits: 2 })}${unit}`;
}

import { BellRing, CheckCircle2, Clock3 } from "lucide-react";
import type { AlertRecord } from "../domain";
import { StatusBadge } from "./StatusBadge";

interface ActiveAlertsProps {
  alerts: readonly AlertRecord[];
}

const alertName = {
  hypoxia: "Hypoxia response",
  rain_overflow: "Rain & overflow",
  heat_salinity: "Heat & salinity",
};

export function ActiveAlerts({ alerts }: ActiveAlertsProps) {
  const activeAlerts = alerts.filter((alert) => alert.status === "active");

  return (
    <section className="panel active-alerts" aria-labelledby="active-alerts-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Live operations</span>
          <h2 id="active-alerts-title">Active alerts</h2>
        </div>
        <span className="panel-heading__icon"><BellRing aria-hidden="true" /></span>
      </div>

      {activeAlerts.length === 0 ? (
        <div className="healthy-empty">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>No active alerts</strong>
            <p>The controller reports no unresolved environmental alerts.</p>
          </div>
        </div>
      ) : (
        <div className="alert-list" aria-live="polite">
          {activeAlerts.map((alert) => (
            <article key={alert.id} className={`alert-card alert-card--${alert.severity}`}>
              <div className="alert-card__header">
                <div>
                  <span className="alert-card__type">{alertName[alert.type]}</span>
                  <h3>{alert.message}</h3>
                </div>
                <StatusBadge
                  label={alert.severity === "critical" ? "Critical" : "Warning"}
                  tone={alert.severity}
                  compact
                />
              </div>
              {Object.keys(alert.measurements).length > 0 && (
                <dl className="alert-measurements">
                  {Object.entries(alert.measurements).map(([key, value]) => (
                    <div key={key}>
                      <dt>{formatMeasurementName(key)}</dt>
                      <dd>{formatMeasurementValue(key, value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="alert-card__time">
                <Clock3 aria-hidden="true" />
                Opened {formatTimestamp(alert.createdAtMs)}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatMeasurementName(key: string): string {
  return ({ do: "DO", ph: "pH", temperature: "Temperature", waterLevel: "Water level", rain: "Rain", ec: "EC", salinity: "Salinity" } as Record<string, string>)[key] ?? key;
}

function formatMeasurementValue(key: string, value: number | boolean): string {
  if (typeof value === "boolean") return value ? "Detected" : "Clear";
  const unit = ({ do: " mg/L", temperature: " °C", waterLevel: "%", salinity: " ppt" } as Record<string, string>)[key] ?? "";
  return `${value}${unit}`;
}

function formatTimestamp(timestampMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(timestampMs);
}

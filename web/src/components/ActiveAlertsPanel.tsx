import { BellRing, CheckCircle2 } from "lucide-react";
import type { KeyedRecord, PondAlert } from "../domain";
import { StatusBadge } from "./StatusBadge";

export function ActiveAlertsPanel({ alerts }: { alerts: Array<KeyedRecord<PondAlert>> }) {
  const activeAlerts = alerts.filter((alert) => alert.value.status === "active");

  return (
    <section className="panel active-alerts" aria-labelledby="active-alerts-title">
      <div className="panel-heading panel-heading--bordered">
        <div>
          <span className="eyebrow">Active alerts</span>
          <h2 id="active-alerts-title">Controller warnings</h2>
        </div>
        <BellRing aria-hidden="true" />
      </div>
      {activeAlerts.length === 0 ? (
        <div className="healthy-empty">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>No active alerts</strong>
            <p>The controller has not reported an active environmental workflow.</p>
          </div>
        </div>
      ) : (
        <ol className="alert-list">
          {activeAlerts.map(({ id, value }) => (
            <li className={`alert-card alert-card--${value.severity}`} key={id}>
              <div className="alert-card__header">
                <span className="alert-card__type">{value.type.replaceAll("_", " ")}</span>
                <StatusBadge label={value.severity} tone={value.severity} />
              </div>
              <p>{value.message}</p>
              <time dateTime={new Date(value.createdAtMs).toISOString()}>{formatTimestamp(value.createdAtMs)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function formatTimestamp(timestampMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestampMs);
}

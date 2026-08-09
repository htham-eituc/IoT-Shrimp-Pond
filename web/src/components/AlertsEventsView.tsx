import { useMemo, useState } from "react";
import { BellRing, ListTree } from "lucide-react";
import type { KeyedRecord, PondAlert, PondEvent } from "../domain";
import { filterAlerts, filterEvents, type AlertFilters, type EventFilters } from "../logs/logFilters";
import { StatusBadge } from "./StatusBadge";

interface AlertsEventsViewProps {
  alerts: Array<KeyedRecord<PondAlert>>;
  events: Array<KeyedRecord<PondEvent>>;
}

const INITIAL_ALERT_FILTERS: AlertFilters = { status: "all", severity: "all", type: "all" };
const INITIAL_EVENT_FILTERS: EventFilters = { type: "all", source: "all" };

export function AlertsEventsView({ alerts, events }: AlertsEventsViewProps) {
  const [alertFilters, setAlertFilters] = useState<AlertFilters>(INITIAL_ALERT_FILTERS);
  const [eventFilters, setEventFilters] = useState<EventFilters>(INITIAL_EVENT_FILTERS);
  const alertTypes = useMemo(() => uniqueValues(alerts.map((alert) => alert.value.type)), [alerts]);
  const eventTypes = useMemo(() => uniqueValues(events.map((event) => event.value.type)), [events]);
  const eventSources = useMemo(() => uniqueValues(events.map((event) => event.value.source ?? "unspecified")), [events]);
  const visibleAlerts = useMemo(() => filterAlerts(alerts, alertFilters), [alertFilters, alerts]);
  const visibleEvents = useMemo(() => filterEvents(events, eventFilters), [eventFilters, events]);

  return (
    <div className="view-stack">
      <div className="page-heading">
        <span className="eyebrow">Operational records</span>
        <h1>Alerts and events</h1>
        <p>Environmental abnormal conditions are kept separate from device actions and system history.</p>
      </div>

      <section className="log-section log-section--alerts" aria-labelledby="alert-log-title">
        <header className="log-section__header">
          <div className="log-title">
            <span className="log-title__icon log-title__icon--alert" aria-hidden="true"><BellRing /></span>
            <div>
              <span className="eyebrow">Environmental conditions</span>
              <h2 id="alert-log-title">Alerts</h2>
              <p>Created and resolved by the IoT controller from pond conditions.</p>
            </div>
          </div>
          <span className="log-count">{visibleAlerts.length} of {alerts.length}</span>
        </header>

        <div className="log-filters" aria-label="Alert filters">
          <FilterSelect
            label="Status"
            value={alertFilters.status}
            options={["all", "active", "resolved"]}
            onChange={(status) => setAlertFilters((current) => ({ ...current, status: status as AlertFilters["status"] }))}
          />
          <FilterSelect
            label="Severity"
            value={alertFilters.severity}
            options={["all", "warning", "critical"]}
            onChange={(severity) => setAlertFilters((current) => ({ ...current, severity: severity as AlertFilters["severity"] }))}
          />
          <FilterSelect
            label="Type"
            value={alertFilters.type}
            options={["all", ...alertTypes]}
            onChange={(type) => setAlertFilters((current) => ({ ...current, type }))}
          />
        </div>

        {visibleAlerts.length === 0 ? (
          <EmptyLog message={alerts.length === 0 ? "No alerts have been published for this pond." : "No alerts match the selected filters."} />
        ) : (
          <ol className="record-list">
            {visibleAlerts.map((alert) => <AlertRecord key={alert.id} alert={alert} />)}
          </ol>
        )}
      </section>

      <section className="log-section log-section--events" aria-labelledby="event-log-title">
        <header className="log-section__header">
          <div className="log-title">
            <span className="log-title__icon" aria-hidden="true"><ListTree /></span>
            <div>
              <span className="eyebrow">Actions and system history</span>
              <h2 id="event-log-title">Events</h2>
              <p>Device actions, mode/threshold changes, connections, and workflow transitions.</p>
            </div>
          </div>
          <span className="log-count">{visibleEvents.length} of {events.length}</span>
        </header>

        <div className="log-filters" aria-label="Event filters">
          <FilterSelect
            label="Type"
            value={eventFilters.type}
            options={["all", ...eventTypes]}
            onChange={(type) => setEventFilters((current) => ({ ...current, type }))}
          />
          <FilterSelect
            label="Source"
            value={eventFilters.source}
            options={["all", ...eventSources]}
            onChange={(source) => setEventFilters((current) => ({ ...current, source }))}
          />
        </div>

        {visibleEvents.length === 0 ? (
          <EmptyLog message={events.length === 0 ? "No events have been published for this pond." : "No events match the selected filters."} />
        ) : (
          <ol className="record-list">
            {visibleEvents.map((event) => <EventRecord key={event.id} event={event} />)}
          </ol>
        )}
      </section>
    </div>
  );
}

function AlertRecord({ alert: { id, value } }: { alert: KeyedRecord<PondAlert> }) {
  const measurements = Object.entries(value.measurements ?? {});
  return (
    <li className={`record-card record-card--${value.severity}`}>
      <div className="record-card__primary">
        <div className="record-card__badges">
          <StatusBadge label={titleCase(value.severity)} tone={value.severity} />
          <StatusBadge label={titleCase(value.status)} tone={value.status === "active" ? value.severity : "normal"} />
          <code>{value.type}</code>
        </div>
        <p>{value.message}</p>
        {measurements.length > 0 && (
          <dl className="measurement-list">
            {measurements.map(([name, measurement]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{formatMeasurement(measurement)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <dl className="record-meta">
        <div><dt>Alert ID</dt><dd>{id}</dd></div>
        <div><dt>Created</dt><dd><Timestamp value={value.createdAtMs} /></dd></div>
        <div><dt>Resolved</dt><dd>{value.resolvedAtMs === null ? "Not resolved" : <Timestamp value={value.resolvedAtMs} />}</dd></div>
      </dl>
    </li>
  );
}

function EventRecord({ event: { id, value } }: { event: KeyedRecord<PondEvent> }) {
  return (
    <li className="record-card record-card--event">
      <div className="record-card__primary">
        <div className="record-card__badges">
          <code>{value.type}</code>
          <span className="source-tag">{value.source ?? "unspecified"}</span>
        </div>
        <p>{describeEvent(value)}</p>
        {(value.device || value.action || value.reason) && (
          <dl className="measurement-list">
            {value.device && <div><dt>device</dt><dd>{value.device}</dd></div>}
            {value.action && <div><dt>action</dt><dd>{value.action}</dd></div>}
            {value.reason && <div><dt>reason</dt><dd>{value.reason}</dd></div>}
          </dl>
        )}
      </div>
      <dl className="record-meta">
        <div><dt>Event ID</dt><dd>{id}</dd></div>
        <div><dt>Created</dt><dd><Timestamp value={value.createdAtMs} /></dd></div>
      </dl>
    </li>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange(value: string): void }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}
      </select>
    </label>
  );
}

function EmptyLog({ message }: { message: string }) {
  return <div className="log-empty" role="status">{message}</div>;
}

function Timestamp({ value }: { value: number }) {
  return <time dateTime={new Date(value).toISOString()}>{formatTimestamp(value)}</time>;
}

function describeEvent(event: PondEvent): string {
  const descriptions: Record<string, string> = {
    device_action: "An actuator action was recorded.",
    mode_change: "The pond operating mode changed.",
    threshold_change: "Pond threshold settings changed.",
    connection: "The controller connection state changed.",
    workflow_started: "An automatic workflow started.",
    workflow_resolved: "An automatic workflow resolved.",
  };
  return descriptions[event.type] ?? "A pond system event was recorded.";
}

function formatMeasurement(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value);
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function formatTimestamp(timestampMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestampMs);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

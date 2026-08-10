import { useMemo, useState } from "react";
import { BellRing, ListTree } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { KeyedRecord, PondAlert, PondEvent } from "../domain";
import { filterAlerts, filterEvents, type AlertFilters, type EventFilters } from "../logs/logFilters";
import { StatusBadge } from "./StatusBadge";
import { useLocaleFormatters } from "../i18n/formatters";

interface AlertsEventsViewProps {
  alerts: Array<KeyedRecord<PondAlert>>;
  events: Array<KeyedRecord<PondEvent>>;
}

const INITIAL_ALERT_FILTERS: AlertFilters = { status: "all", severity: "all", type: "all" };
const INITIAL_EVENT_FILTERS: EventFilters = { type: "all", source: "all" };

export function AlertsEventsView({ alerts, events }: AlertsEventsViewProps) {
  const { t } = useTranslation(["common", "alerts", "events"]);
  const formatters = useLocaleFormatters();
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
        <span className="eyebrow">{t("operationalRecords", { ns: "events" })}</span>
        <h1>{t("pageTitle", { ns: "events" })}</h1>
        <p>{t("pageDescription", { ns: "events" })}</p>
      </div>

      <section className="log-section log-section--alerts" aria-labelledby="alert-log-title">
        <header className="log-section__header">
          <div className="log-title">
            <span className="log-title__icon log-title__icon--alert" aria-hidden="true"><BellRing /></span>
            <div>
              <span className="eyebrow">{t("environmentalConditions", { ns: "alerts" })}</span>
              <h2 id="alert-log-title">{t("title", { ns: "alerts" })}</h2>
              <p>{t("description", { ns: "alerts" })}</p>
            </div>
          </div>
          <span className="log-count">{t("countOf", { ns: "common", shown: formatters.number(visibleAlerts.length), total: formatters.number(alerts.length) })}</span>
        </header>

        <div className="log-filters" aria-label={t("filtersAriaLabel", { ns: "alerts" })}>
          <FilterSelect
            label={t("status", { ns: "alerts" })}
            value={alertFilters.status}
            options={["all", "active", "resolved"]}
            optionLabel={(option) => translateStatusOption(option, t)}
            onChange={(status) => setAlertFilters((current) => ({ ...current, status: status as AlertFilters["status"] }))}
          />
          <FilterSelect
            label={t("severity", { ns: "alerts" })}
            value={alertFilters.severity}
            options={["all", "warning", "critical"]}
            optionLabel={(option) => translateStatusOption(option, t)}
            onChange={(severity) => setAlertFilters((current) => ({ ...current, severity: severity as AlertFilters["severity"] }))}
          />
          <FilterSelect
            label={t("type", { ns: "alerts" })}
            value={alertFilters.type}
            options={["all", ...alertTypes]}
            optionLabel={(option) => translateAlertType(option, t)}
            onChange={(type) => setAlertFilters((current) => ({ ...current, type }))}
          />
        </div>

        {visibleAlerts.length === 0 ? (
          <EmptyLog message={t(alerts.length === 0 ? "noPublished" : "noMatch", { ns: "alerts" })} />
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
              <span className="eyebrow">{t("actionsHistory", { ns: "events" })}</span>
              <h2 id="event-log-title">{t("title", { ns: "events" })}</h2>
              <p>{t("description", { ns: "events" })}</p>
            </div>
          </div>
          <span className="log-count">{t("countOf", { ns: "common", shown: formatters.number(visibleEvents.length), total: formatters.number(events.length) })}</span>
        </header>

        <div className="log-filters" aria-label={t("filtersAriaLabel", { ns: "events" })}>
          <FilterSelect
            label={t("type", { ns: "events" })}
            value={eventFilters.type}
            options={["all", ...eventTypes]}
            optionLabel={(option) => translateEventType(option, t)}
            onChange={(type) => setEventFilters((current) => ({ ...current, type }))}
          />
          <FilterSelect
            label={t("source", { ns: "events" })}
            value={eventFilters.source}
            options={["all", ...eventSources]}
            optionLabel={(option) => translateSource(option, t)}
            onChange={(source) => setEventFilters((current) => ({ ...current, source }))}
          />
        </div>

        {visibleEvents.length === 0 ? (
          <EmptyLog message={t(events.length === 0 ? "noPublished" : "noMatch", { ns: "events" })} />
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
  const { t } = useTranslation(["common", "sensors", "alerts"]);
  const formatters = useLocaleFormatters();
  const measurements = Object.entries(value.measurements ?? {});
  return (
    <li className={`record-card record-card--${value.severity}`}>
      <div className="record-card__primary">
        <div className="record-card__badges">
          <StatusBadge label={t(`status.${value.severity}`, { ns: "common" })} tone={value.severity} />
          <StatusBadge label={t(`status.${value.status}`, { ns: "common" })} tone={value.status === "active" ? value.severity : "normal"} />
          <code>{translateAlertType(value.type, t)}</code>
        </div>
        <p>{translateAlertMessage(value, t)}</p>
        {measurements.length > 0 && (
          <dl className="measurement-list">
            {measurements.map(([name, measurement]) => (
              <div key={name}>
                <dt>{translateMeasurementName(name, t)}</dt>
                <dd>{formatMeasurement(measurement, t, formatters.number)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <dl className="record-meta">
        <div><dt>{t("alertId", { ns: "alerts" })}</dt><dd>{id}</dd></div>
        <div><dt>{t("created", { ns: "common" })}</dt><dd><Timestamp value={value.createdAtMs} /></dd></div>
        <div><dt>{t("resolved", { ns: "common" })}</dt><dd>{value.resolvedAtMs === null ? t("notResolved", { ns: "common" }) : <Timestamp value={value.resolvedAtMs} />}</dd></div>
      </dl>
    </li>
  );
}

function EventRecord({ event: { id, value } }: { event: KeyedRecord<PondEvent> }) {
  const { t } = useTranslation(["common", "devices", "events"]);
  return (
    <li className="record-card record-card--event">
      <div className="record-card__primary">
        <div className="record-card__badges">
          <code>{translateEventType(value.type, t)}</code>
          <span className="source-tag">{translateSource(value.source ?? "unspecified", t)}</span>
        </div>
        <p>{describeEvent(value, t)}</p>
        {(value.device || value.action || value.reason) && (
          <dl className="measurement-list">
            {value.device && <div><dt>{t("device", { ns: "events" })}</dt><dd>{t(`${value.device}.label`, { ns: "devices" })}</dd></div>}
            {value.action && <div><dt>{t("action", { ns: "events" })}</dt><dd>{t(`action.${value.action}`, { ns: "common" })}</dd></div>}
            {value.reason && <div><dt>{t("reason", { ns: "events" })}</dt><dd>{translateReason(value.reason, t)}</dd></div>}
          </dl>
        )}
      </div>
      <dl className="record-meta">
        <div><dt>{t("eventId", { ns: "events" })}</dt><dd>{id}</dd></div>
        <div><dt>{t("created", { ns: "common" })}</dt><dd><Timestamp value={value.createdAtMs} /></dd></div>
      </dl>
    </li>
  );
}

function FilterSelect({ label, value, options, optionLabel, onChange }: { label: string; value: string; options: string[]; optionLabel(value: string): string; onChange(value: string): void }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{optionLabel(option)}</option>)}
      </select>
    </label>
  );
}

function EmptyLog({ message }: { message: string }) {
  return <div className="log-empty" role="status">{message}</div>;
}

function Timestamp({ value }: { value: number }) {
  const formatters = useLocaleFormatters();
  return <time dateTime={new Date(value).toISOString()}>{formatters.timestamp(value)}</time>;
}

function describeEvent(event: PondEvent, t: TFunction): string {
  return KNOWN_EVENT_TYPES.has(event.type)
    ? t(`descriptions.${event.type}`, { ns: "events" })
    : t("descriptions.unknown", { ns: "events" });
}

function formatMeasurement(value: unknown, t: TFunction, number: (value: number, options?: Intl.NumberFormatOptions) => string): string {
  if (typeof value === "boolean") return t(`boolean.${value}`, { ns: "common" });
  if (typeof value === "number") return number(value, { maximumFractionDigits: 2 });
  return String(value);
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

const KNOWN_ALERT_TYPES = new Set(["hypoxia", "rain_overflow", "heat_salinity"]);
const KNOWN_EVENT_TYPES = new Set(["device_action", "mode_change", "threshold_change", "connection", "workflow_started", "workflow_resolved"]);
const SENSOR_KEYS = new Set(["ph", "do", "temperature", "waterLevel", "rain", "ec", "salinity"]);

function translateStatusOption(value: string, t: TFunction): string {
  return value === "all" ? t("all", { ns: "common" }) : t(`status.${value}`, { ns: "common" });
}

function translateAlertType(value: string, t: TFunction): string {
  if (value === "all") return t("all", { ns: "common" });
  return KNOWN_ALERT_TYPES.has(value) ? t(`types.${value}`, { ns: "alerts" }) : value.replaceAll("_", " ");
}

function translateAlertMessage(alert: PondAlert, t: TFunction): string {
  return KNOWN_ALERT_TYPES.has(alert.type) ? t(`messages.${alert.type}`, { ns: "alerts" }) : alert.message;
}

function translateEventType(value: string, t: TFunction): string {
  if (value === "all") return t("all", { ns: "common" });
  return KNOWN_EVENT_TYPES.has(value) ? t(`types.${value}`, { ns: "events" }) : value.replaceAll("_", " ");
}

function translateSource(value: string, t: TFunction): string {
  if (value === "all") return t("all", { ns: "common" });
  if (value === "unspecified") return t("unspecified", { ns: "common" });
  return value === "automatic" || value === "manual" ? t(`mode.${value}`, { ns: "common" }) : value;
}

function translateMeasurementName(value: string, t: TFunction): string {
  return SENSOR_KEYS.has(value) ? t(`${value}.label`, { ns: "sensors" }) : value;
}

function translateReason(value: string, t: TFunction): string {
  return ["controller_online", "hypoxia_watch", "normal_recovery", "heat_salinity"].includes(value)
    ? t(`reasons.${value}`, { ns: "events" })
    : value;
}

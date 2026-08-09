import type { KeyedRecord, PondAlert, PondEvent } from "../domain";

export interface AlertFilters {
  status: "all" | PondAlert["status"];
  severity: "all" | PondAlert["severity"];
  type: string;
}

export interface EventFilters {
  type: string;
  source: string;
}

export function filterAlerts(
  alerts: Array<KeyedRecord<PondAlert>>,
  filters: AlertFilters,
): Array<KeyedRecord<PondAlert>> {
  return alerts.filter(({ value }) => {
    if (filters.status !== "all" && value.status !== filters.status) return false;
    if (filters.severity !== "all" && value.severity !== filters.severity) return false;
    if (filters.type !== "all" && value.type !== filters.type) return false;
    return true;
  });
}

export function filterEvents(
  events: Array<KeyedRecord<PondEvent>>,
  filters: EventFilters,
): Array<KeyedRecord<PondEvent>> {
  return events.filter(({ value }) => {
    if (filters.type !== "all" && value.type !== filters.type) return false;
    if (filters.source !== "all" && (value.source ?? "unspecified") !== filters.source) return false;
    return true;
  });
}

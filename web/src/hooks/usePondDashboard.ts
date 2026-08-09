import { useEffect, useMemo, useState } from "react";
import type {
  Command,
  KeyedRecord,
  PondAlert,
  PondEvent,
  PondSettings,
  PondState,
  TelemetryRecord,
} from "../domain";
import type { PondDataSource } from "../data";

interface DashboardDataState {
  pond: PondState | null;
  settings: PondSettings | null;
  alerts: Array<KeyedRecord<PondAlert>>;
  events: Array<KeyedRecord<PondEvent>>;
  commands: Array<KeyedRecord<Command>>;
  telemetry: Array<KeyedRecord<TelemetryRecord>>;
  loading: boolean;
  error: string | null;
}

export function usePondDashboard(dataSource: PondDataSource, pondId: string): DashboardDataState {
  const [pond, setPond] = useState<PondState | null>(null);
  const [settings, setSettings] = useState<PondSettings | null>(null);
  const [alerts, setAlerts] = useState<Array<KeyedRecord<PondAlert>>>([]);
  const [events, setEvents] = useState<Array<KeyedRecord<PondEvent>>>([]);
  const [commands, setCommands] = useState<Array<KeyedRecord<Command>>>([]);
  const [telemetry, setTelemetry] = useState<Array<KeyedRecord<TelemetryRecord>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const unsubscribes = [
        dataSource.subscribePond(pondId, setPond),
        dataSource.subscribeSettings(pondId, setSettings),
        dataSource.subscribeAlerts(pondId, (nextAlerts) => {
          setAlerts(sortKeyedRecordsByCreatedAt(nextAlerts));
        }),
        dataSource.subscribeEvents(pondId, (nextEvents) => {
          setEvents(sortKeyedRecordsByCreatedAt(nextEvents));
        }),
        dataSource.subscribeCommands(pondId, (nextCommands) => {
          setCommands(sortKeyedRecordsByCreatedAt(nextCommands));
        }),
      ];

      void dataSource
        .getTelemetry(pondId, { limit: 24 })
        .then(setTelemetry)
        .catch((reason: unknown) => {
          setError(reason instanceof Error ? reason.message : "Could not load telemetry.");
        })
        .finally(() => setLoading(false));

      return () => {
        for (const unsubscribe of unsubscribes) {
          unsubscribe();
        }
      };
    } catch (reason) {
      queueMicrotask(() => {
        setLoading(false);
        setError(reason instanceof Error ? reason.message : "Could not subscribe to pond data.");
      });
      return undefined;
    }
  }, [dataSource, pondId]);

  useEffect(() => {
    if (!pond) return;
    void dataSource
      .getTelemetry(pondId, { limit: 24 })
      .then(setTelemetry)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Could not refresh telemetry.");
      });
  }, [dataSource, pond, pondId]);

  return useMemo(
    () => ({
      pond,
      settings,
      alerts,
      events,
      commands,
      telemetry,
      loading,
      error,
    }),
    [alerts, commands, error, events, loading, pond, settings, telemetry],
  );
}

function sortKeyedRecordsByCreatedAt<T extends { createdAtMs: number }>(records: Array<KeyedRecord<T>>): Array<KeyedRecord<T>> {
  return [...records].sort((left, right) => right.value.createdAtMs - left.value.createdAtMs);
}

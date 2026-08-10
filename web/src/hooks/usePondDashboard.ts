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

type DashboardErrorKey = "telemetryLoad" | "telemetryRefresh" | "pondSubscribe";

interface DashboardDataState {
  pond: PondState | null;
  settings: PondSettings | null;
  alerts: Array<KeyedRecord<PondAlert>>;
  events: Array<KeyedRecord<PondEvent>>;
  commands: Array<KeyedRecord<Command>>;
  telemetry: Array<KeyedRecord<TelemetryRecord>>;
  loading: boolean;
  error: DashboardErrorKey | null;
}

export function usePondDashboard(dataSource: PondDataSource, pondId: string): DashboardDataState {
  const [pond, setPond] = useState<PondState | null>(null);
  const [settings, setSettings] = useState<PondSettings | null>(null);
  const [alerts, setAlerts] = useState<Array<KeyedRecord<PondAlert>>>([]);
  const [events, setEvents] = useState<Array<KeyedRecord<PondEvent>>>([]);
  const [commands, setCommands] = useState<Array<KeyedRecord<Command>>>([]);
  const [telemetry, setTelemetry] = useState<Array<KeyedRecord<TelemetryRecord>>>([]);
  const [error, setError] = useState<DashboardErrorKey | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const onSubscriptionError = () => {
        setError("pondSubscribe");
        setLoading(false);
      };
      const unsubscribes = [
        dataSource.subscribePond(pondId, setPond, onSubscriptionError),
        dataSource.subscribeSettings(pondId, setSettings, onSubscriptionError),
        dataSource.subscribeAlerts(pondId, (nextAlerts) => {
          setAlerts(sortKeyedRecordsByCreatedAt(nextAlerts));
        }, onSubscriptionError),
        dataSource.subscribeEvents(pondId, (nextEvents) => {
          setEvents(sortKeyedRecordsByCreatedAt(nextEvents));
        }, onSubscriptionError),
        dataSource.subscribeCommands(pondId, (nextCommands) => {
          setCommands(sortKeyedRecordsByCreatedAt(nextCommands));
        }, onSubscriptionError),
      ];

      void dataSource
        .getTelemetry(pondId, { limit: 24 })
        .then(setTelemetry)
        .catch(() => {
          setError("telemetryLoad");
        })
        .finally(() => setLoading(false));

      return () => {
        for (const unsubscribe of unsubscribes) {
          unsubscribe();
        }
      };
    } catch {
      queueMicrotask(() => {
        setLoading(false);
        setError("pondSubscribe");
      });
      return undefined;
    }
  }, [dataSource, pondId]);

  useEffect(() => {
    if (!pond) return;
    void dataSource
      .getTelemetry(pondId, { limit: 24 })
      .then(setTelemetry)
      .catch(() => {
        setError("telemetryRefresh");
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

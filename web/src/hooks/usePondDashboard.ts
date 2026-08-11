import { useEffect, useMemo, useRef, useState } from "react";
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

export interface ScopedDashboardState extends DashboardDataState {
  dataSource: PondDataSource;
  pondId: string;
}

export function usePondDashboard(dataSource: PondDataSource, pondId: string): DashboardDataState {
  const [state, setState] = useState<ScopedDashboardState>(() => createLoadingState(dataSource, pondId));
  const telemetryRequestSequence = useRef(0);
  const stateMatchesRequest = state.dataSource === dataSource && state.pondId === pondId;
  const visibleState = stateMatchesRequest ? state : createLoadingState(dataSource, pondId);

  useEffect(() => {
    let active = true;
    const scope = { dataSource, pondId };
    const commit = (changes: Partial<DashboardDataState>) => {
      if (!active) return;
      setState((current) => {
        if (isCurrentDashboardScope(current, scope)) {
          return applyScopedDashboardUpdate(current, scope, changes);
        }
        return { ...createLoadingState(dataSource, pondId), ...changes };
      });
    };

    try {
      const onSubscriptionError = () => {
        commit({ error: "pondSubscribe", loading: false });
      };
      const unsubscribes = [
        dataSource.subscribePond(pondId, (nextPond) => {
          commit({ pond: nextPond });
        }, onSubscriptionError),
        dataSource.subscribeSettings(pondId, (nextSettings) => {
          commit({ settings: nextSettings });
        }, onSubscriptionError),
        dataSource.subscribeAlerts(pondId, (nextAlerts) => {
          commit({ alerts: sortKeyedRecordsByCreatedAt(nextAlerts) });
        }, onSubscriptionError),
        dataSource.subscribeEvents(pondId, (nextEvents) => {
          commit({ events: sortKeyedRecordsByCreatedAt(nextEvents) });
        }, onSubscriptionError),
        dataSource.subscribeCommands(pondId, (nextCommands) => {
          commit({ commands: sortKeyedRecordsByCreatedAt(nextCommands) });
        }, onSubscriptionError),
      ];

      const telemetryRequestId = ++telemetryRequestSequence.current;
      void dataSource
        .getTelemetry(pondId, { limit: 24 })
        .then((nextTelemetry) => {
          if (telemetryRequestSequence.current !== telemetryRequestId) return;
          commit({ telemetry: nextTelemetry });
        })
        .catch(() => {
          if (telemetryRequestSequence.current !== telemetryRequestId) return;
          commit({ error: "telemetryLoad" });
        })
        .finally(() => {
          if (telemetryRequestSequence.current !== telemetryRequestId) return;
          commit({ loading: false });
        });

      return () => {
        active = false;
        for (const unsubscribe of unsubscribes) {
          unsubscribe();
        }
      };
    } catch {
      queueMicrotask(() => {
        commit({ loading: false, error: "pondSubscribe" });
      });
      return () => {
        active = false;
      };
    }
  }, [dataSource, pondId]);

  useEffect(() => {
    if (!visibleState.pond) return;
    let active = true;
    const scope = { dataSource, pondId };
    const telemetryRequestId = ++telemetryRequestSequence.current;
    void dataSource
      .getTelemetry(pondId, { limit: 24 })
      .then((nextTelemetry) => {
        if (!active || telemetryRequestSequence.current !== telemetryRequestId) return;
        setState((current) => (
          isCurrentScope(current, scope)
            ? { ...current, telemetry: nextTelemetry }
            : current
        ));
      })
      .catch(() => {
        if (!active || telemetryRequestSequence.current !== telemetryRequestId) return;
        setState((current) => (
          isCurrentScope(current, scope)
            ? { ...current, error: "telemetryRefresh" }
            : current
        ));
      })
      .finally(() => {
        if (!active || telemetryRequestSequence.current !== telemetryRequestId) return;
        setState((current) => (
          isCurrentScope(current, scope)
            ? { ...current, loading: false }
            : current
        ));
      });
    return () => {
      active = false;
    };
  }, [dataSource, pondId, visibleState.pond]);

  return useMemo(
    () => ({
      pond: visibleState.pond,
      settings: visibleState.settings,
      alerts: visibleState.alerts,
      events: visibleState.events,
      commands: visibleState.commands,
      telemetry: visibleState.telemetry,
      loading: visibleState.loading,
      error: visibleState.error,
    }),
    [
      visibleState.alerts,
      visibleState.commands,
      visibleState.error,
      visibleState.events,
      visibleState.loading,
      visibleState.pond,
      visibleState.settings,
      visibleState.telemetry,
    ],
  );
}

export function createScopedDashboardLoadingState(dataSource: PondDataSource, pondId: string): ScopedDashboardState {
  return {
    dataSource,
    pondId,
    pond: null,
    settings: null,
    alerts: [],
    events: [],
    commands: [],
    telemetry: [],
    loading: true,
    error: null,
  };
}

export function isCurrentDashboardScope(
  current: ScopedDashboardState,
  scope: { dataSource: PondDataSource; pondId: string },
): boolean {
  return current.dataSource === scope.dataSource && current.pondId === scope.pondId;
}

export function applyScopedDashboardUpdate(
  current: ScopedDashboardState,
  scope: { dataSource: PondDataSource; pondId: string },
  changes: Partial<DashboardDataState>,
): ScopedDashboardState {
  if (!isCurrentDashboardScope(current, scope)) return current;
  return { ...current, ...changes };
}

const createLoadingState = createScopedDashboardLoadingState;
const isCurrentScope = isCurrentDashboardScope;

function sortKeyedRecordsByCreatedAt<T extends { createdAtMs: number }>(records: Array<KeyedRecord<T>>): Array<KeyedRecord<T>> {
  return [...records].sort((left, right) => right.value.createdAtMs - left.value.createdAtMs);
}

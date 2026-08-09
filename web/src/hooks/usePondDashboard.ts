import { useCallback, useEffect, useState } from "react";
import type { PondDataSource } from "../data/PondDataSource";
import type {
  AlertRecord,
  CommandRecord,
  DeviceAction,
  DeviceName,
  EventRecord,
  FarmerSession,
  PondSettings,
  PondState,
  TelemetryRecord,
} from "../domain";

export interface PondDashboardState {
  session: FarmerSession | null;
  authReady: boolean;
  pond: PondState | null;
  settings: PondSettings | null;
  alerts: readonly AlertRecord[];
  events: readonly EventRecord[];
  commands: readonly CommandRecord[];
  telemetry: readonly TelemetryRecord[];
  loading: boolean;
  error: string | null;
}

export function usePondDashboard(dataSource: PondDataSource) {
  const [session, setSession] = useState<FarmerSession | null>(() =>
    dataSource.getCurrentSession(),
  );
  const [authReady, setAuthReady] = useState(false);
  const [pond, setPond] = useState<PondState | null>(null);
  const [settings, setSettings] = useState<PondSettings | null>(null);
  const [alerts, setAlerts] = useState<readonly AlertRecord[]>([]);
  const [events, setEvents] = useState<readonly EventRecord[]>([]);
  const [commands, setCommands] = useState<readonly CommandRecord[]>([]);
  const [telemetry, setTelemetry] = useState<readonly TelemetryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((reason: Error) => {
    setError(reason.message || "The pond data source returned an unexpected error.");
    setLoading(false);
  }, []);

  useEffect(
    () =>
      dataSource.observeSession(
        (nextSession) => {
          setPond(null);
          setSettings(null);
          setAlerts([]);
          setEvents([]);
          setCommands([]);
          setTelemetry([]);
          setSession(nextSession);
          setAuthReady(true);
          setError(null);
          setLoading(nextSession !== null);
        },
        handleError,
      ),
    [dataSource, handleError],
  );

  const pondId = session?.profile.pondId;

  useEffect(() => {
    if (!pondId) {
      return;
    }

    const unsubscribers = [
      dataSource.subscribePond(
        pondId,
        (nextPond) => {
          setPond(nextPond);
          setLoading(false);
        },
        handleError,
      ),
      dataSource.subscribeSettings(pondId, setSettings, handleError),
      dataSource.subscribeAlerts(pondId, setAlerts, handleError),
      dataSource.subscribeEvents(pondId, setEvents, handleError),
      dataSource.subscribeCommands(pondId, setCommands, handleError),
    ];

    let cancelled = false;
    void dataSource
      .loadTelemetry(pondId, { limit: 72 })
      .then((samples) => {
        if (!cancelled) {
          setTelemetry(samples);
        }
      })
      .catch(handleError);

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [dataSource, handleError, pondId]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        return await dataSource.signIn(email, password);
      } catch (reason) {
        handleError(toError(reason));
        throw reason;
      }
    },
    [dataSource, handleError],
  );

  const signOut = useCallback(async () => {
    setError(null);
    await dataSource.signOut();
  }, [dataSource]);

  const sendCommand = useCallback(
    async (device: DeviceName, action: DeviceAction) => {
      if (!pondId) {
        throw new Error("No pond is assigned to the current session.");
      }
      return dataSource.createManualCommand(pondId, { device, action });
    },
    [dataSource, pondId],
  );

  const saveSettings = useCallback(
    async (nextSettings: PondSettings) => {
      if (!pondId) {
        throw new Error("No pond is assigned to the current session.");
      }
      return dataSource.updateSettings(pondId, nextSettings);
    },
    [dataSource, pondId],
  );

  const refreshTelemetry = useCallback(async () => {
    if (!pondId) {
      return;
    }
    try {
      setTelemetry(await dataSource.loadTelemetry(pondId, { limit: 72 }));
    } catch (reason) {
      handleError(toError(reason));
    }
  }, [dataSource, handleError, pondId]);

  const state: PondDashboardState = {
    session,
    authReady,
    pond,
    settings,
    alerts,
    events,
    commands,
    telemetry,
    loading,
    error,
  };

  return {
    state,
    signIn,
    signOut,
    sendCommand,
    saveSettings,
    refreshTelemetry,
  };
}

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error("Unexpected pond data error.");
}

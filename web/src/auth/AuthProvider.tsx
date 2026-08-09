import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./AuthContext";
import type { DashboardSession } from "../domain/session";
import type { PondDataSource } from "../data";
import {
  clearStoredSession,
  createMockSession,
  getMockEmailHint,
  readStoredSession,
  validateMockCredentials,
  writeStoredSession,
} from "./mockAuth";

export function AuthProvider({ children, dataSource }: { children: ReactNode; dataSource: PondDataSource }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [session, setSession] = useState<DashboardSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedSession = readStoredSession(window.localStorage);
      if (!storedSession) {
        setSession(null);
        setStatus("ready");
        return;
      }

      void dataSource
        .signIn(getMockEmailHint(), "restored-session")
        .then(() => {
          setSession(storedSession);
          setStatus("ready");
        })
        .catch(() => {
          clearStoredSession(window.localStorage);
          setSession(null);
          setStatus("ready");
        });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [dataSource]);

  const signIn = useCallback(async (email: string, password: string) => {
    setStatus("signing-in");
    setError(null);
    await delay(260);

    if (!validateMockCredentials(email, password)) {
      setSession(null);
      setStatus("ready");
      setError("Invalid mock login. Use the mock farmer account and any non-empty placeholder password.");
      return;
    }

    await dataSource.signIn(email, password);
    const nextSession = createMockSession();
    writeStoredSession(window.localStorage, nextSession);
    setSession(nextSession);
    setStatus("ready");
  }, [dataSource]);

  const signOut = useCallback(() => {
    void dataSource.signOut();
    clearStoredSession(window.localStorage);
    setSession(null);
    setStatus("ready");
    setError(null);
  }, [dataSource]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      error,
      emailHint: getMockEmailHint(),
      signIn,
      signOut,
    }),
    [error, session, signIn, signOut, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

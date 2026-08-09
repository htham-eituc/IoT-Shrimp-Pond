import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./AuthContext";
import type { DashboardSession } from "../domain/session";
import {
  clearStoredSession,
  createMockSession,
  getMockEmailHint,
  readStoredSession,
  validateMockCredentials,
  writeStoredSession,
} from "./mockAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [session, setSession] = useState<DashboardSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSession(readStoredSession(window.localStorage));
      setStatus("ready");
    }, 180);

    return () => window.clearTimeout(timer);
  }, []);

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

    const nextSession = createMockSession();
    writeStoredSession(window.localStorage, nextSession);
    setSession(nextSession);
    setStatus("ready");
  }, []);

  const signOut = useCallback(() => {
    clearStoredSession(window.localStorage);
    setSession(null);
    setStatus("ready");
    setError(null);
  }, []);

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

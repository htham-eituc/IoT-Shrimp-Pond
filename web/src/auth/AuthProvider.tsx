import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./AuthContext";
import type { AuthenticatedUser } from "../domain";
import type { DashboardSession } from "../domain/session";
import type { PondDataSource } from "../data";

export function AuthProvider({ children, dataSource }: { children: ReactNode; dataSource: PondDataSource }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [session, setSession] = useState<DashboardSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void dataSource
      .restoreSession()
      .then((user) => {
        if (!active) return;
        setSession(user ? createDashboardSession(user) : null);
        setStatus("ready");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setSession(null);
        setError(reason instanceof Error ? reason.message : "Could not restore the dashboard session.");
        setStatus("ready");
      });

    return () => {
      active = false;
    };
  }, [dataSource]);

  const signIn = useCallback(async (email: string, password: string) => {
    setStatus("signing-in");
    setError(null);
    try {
      const user = await dataSource.signIn(email, password);
      setSession(createDashboardSession(user));
    } catch (reason) {
      setSession(null);
      setError(reason instanceof Error ? reason.message : "Sign-in failed.");
    } finally {
      setStatus("ready");
    }
  }, [dataSource]);

  const signOut = useCallback(() => {
    void dataSource.signOut().catch(() => undefined);
    setSession(null);
    setStatus("ready");
    setError(null);
  }, [dataSource]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      error,
      emailHint: "",
      signIn,
      signOut,
    }),
    [error, session, signIn, signOut, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function createDashboardSession(user: AuthenticatedUser): DashboardSession {
  if (user.profile.role !== "farmer") {
    throw new Error("Only farmer accounts can open the dashboard.");
  }
  return {
    profile: { ...user.profile, role: "farmer" },
    pond: {
      id: user.profile.pondId,
      name: `Pond ${user.profile.pondId}`,
      connected: false,
      mode: "automatic",
    },
  };
}

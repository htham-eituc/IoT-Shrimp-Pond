import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./AuthContext";
import type { AuthenticatedUser } from "../domain";
import type { DashboardSession } from "../domain/session";
import type { PondDataSource } from "../data";
import i18n, { translateError } from "../i18n";
import { useTranslation } from "react-i18next";

interface AuthErrorState {
  reason: unknown;
  fallbackKey: "sessionRestore" | "signIn";
}

export function AuthProvider({ children, dataSource }: { children: ReactNode; dataSource: PondDataSource }) {
  const { t } = useTranslation("errors");
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [session, setSession] = useState<DashboardSession | null>(null);
  const [errorState, setErrorState] = useState<AuthErrorState | null>(null);
  const error = errorState ? translateError(errorState.reason, errorState.fallbackKey, t) : null;

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
        setErrorState({ reason, fallbackKey: "sessionRestore" });
        setStatus("ready");
      });

    return () => {
      active = false;
    };
  }, [dataSource]);

  const signIn = useCallback(async (email: string, password: string) => {
    setStatus("signing-in");
    setErrorState(null);
    try {
      const user = await dataSource.signIn(email, password);
      setSession(createDashboardSession(user));
    } catch (reason) {
      setSession(null);
      setErrorState({ reason, fallbackKey: "signIn" });
    } finally {
      setStatus("ready");
    }
  }, [dataSource]);

  const signOut = useCallback(() => {
    void dataSource.signOut().catch(() => undefined);
    setSession(null);
    setStatus("ready");
    setErrorState(null);
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
      name: i18n.t("pondFallback", { ns: "dashboard", pondId: user.profile.pondId }),
      connected: false,
      mode: "automatic",
    },
  };
}

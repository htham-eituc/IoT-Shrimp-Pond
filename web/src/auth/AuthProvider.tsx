import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AuthContext,
  type AuthContextValue,
  type AuthOperation,
  type AuthStatus,
} from "./AuthContext";
import type { AuthSource } from "./AuthSource";
import type { AuthenticatedFarmer, DashboardSession } from "../domain/session";
import i18n, { translateError } from "../i18n";
import { useTranslation } from "react-i18next";

interface AuthErrorState {
  reason: unknown;
  fallbackKey: "sessionRestore" | "signIn" | "signOut";
}

export function AuthProvider({ children, authSource }: { children: ReactNode; authSource: AuthSource }) {
  const { t } = useTranslation("errors");
  const [status, setStatus] = useState<AuthStatus>("initializing");
  const [operation, setOperation] = useState<AuthOperation>("idle");
  const [session, setSession] = useState<DashboardSession | null>(null);
  const [errorState, setErrorState] = useState<AuthErrorState | null>(null);
  const error = errorState ? translateError(errorState.reason, errorState.fallbackKey, t) : null;

  useEffect(() => {
    const unsubscribe = authSource.observeSession(
      (state) => {
        if (state.status === "signed-out") {
          setSession(null);
          setStatus("unauthenticated");
          setOperation("idle");
          return;
        }
        if (state.status === "validating-profile") {
          setSession(null);
          setErrorState(null);
          setStatus("initializing");
          setOperation("validating-profile");
          return;
        }

        setSession(createDashboardSession(state.user));
        setErrorState(null);
        setStatus("authenticated-profile-ready");
        setOperation("idle");
      },
      (reason) => {
        setSession(null);
        setErrorState({ reason, fallbackKey: "sessionRestore" });
        setStatus("unauthenticated");
        setOperation("idle");
      },
    );

    return unsubscribe;
  }, [authSource]);

  const signIn = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    setOperation("submitting");
    setErrorState(null);
    try {
      await authSource.signIn(email, password, rememberMe);
    } catch (reason) {
      setSession(null);
      setErrorState({ reason, fallbackKey: "signIn" });
      setStatus("unauthenticated");
      setOperation("idle");
    }
  }, [authSource]);

  const signOut = useCallback(async () => {
    setErrorState(null);
    setSession(null);
    setStatus("initializing");
    setOperation("signing-out");
    try {
      await authSource.signOut();
    } catch (reason) {
      setErrorState({ reason, fallbackKey: "signOut" });
      setStatus("unauthenticated");
      setOperation("idle");
    }
  }, [authSource]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      operation,
      session,
      error,
      emailHint: "",
      signIn,
      signOut,
    }),
    [error, operation, session, signIn, signOut, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function createDashboardSession(user: AuthenticatedFarmer): DashboardSession {
  return {
    user,
    pond: {
      id: user.pondId,
      name: i18n.t("pondFallback", { ns: "dashboard", pondId: user.pondId }),
      connected: false,
      mode: "automatic",
    },
  };
}

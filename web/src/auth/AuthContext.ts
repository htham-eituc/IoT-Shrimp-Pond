import { createContext } from "react";
import type { DashboardSession } from "../domain/session";

export type AuthStatus = "initializing" | "unauthenticated" | "authenticated-profile-ready";
export type AuthOperation = "idle" | "submitting" | "validating-profile" | "signing-out";

export interface AuthContextValue {
  status: AuthStatus;
  operation: AuthOperation;
  session: DashboardSession | null;
  error: string | null;
  emailHint: string;
  signIn(email: string, password: string, rememberMe: boolean): Promise<void>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

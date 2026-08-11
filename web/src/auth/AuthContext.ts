import { createContext } from "react";
import type { DashboardSession } from "../domain/session";

export type AuthStatus = "initializing" | "unauthenticated" | "authenticated-profile-ready";
export type AuthOperation = "idle" | "submitting" | "validating-profile" | "signing-out";
export type SessionEntryKind = "interactive" | "restored";

export interface AuthContextValue {
  status: AuthStatus;
  operation: AuthOperation;
  entryKind: SessionEntryKind | null;
  session: DashboardSession | null;
  error: string | null;
  emailHint: string;
  rememberLogin: boolean;
  signIn(email: string, password: string, rememberMe: boolean): Promise<boolean>;
  signOut(): Promise<void>;
  forgetRememberedAccount(): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

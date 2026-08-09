import { createContext } from "react";
import type { DashboardSession } from "../domain/session";

export type AuthStatus = "checking" | "ready" | "signing-in";

export interface AuthContextValue {
  status: AuthStatus;
  session: DashboardSession | null;
  error: string | null;
  emailHint: string;
  signIn(email: string, password: string): Promise<void>;
  signOut(): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

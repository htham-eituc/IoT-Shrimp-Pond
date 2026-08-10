import type { AuthenticatedFarmer } from "../domain/session";

export type AuthSessionState =
  | { status: "signed-out" }
  | { status: "validating-profile" }
  | { status: "authenticated"; user: AuthenticatedFarmer };

export type AuthUnsubscribe = () => void;

export interface AuthSource {
  observeSession(
    listener: (state: AuthSessionState) => void,
    onError?: (error: Error) => void,
  ): AuthUnsubscribe;
  signIn(email: string, password: string, rememberMe: boolean): Promise<void>;
  signOut(): Promise<void>;
}

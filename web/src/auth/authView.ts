import type { AuthStatus } from "./AuthContext";

export type AuthenticatedApplicationView = "loading" | "login" | "dashboard";

export function resolveAuthenticatedApplicationView(
  status: AuthStatus,
  hasAuthorizedSession: boolean,
): AuthenticatedApplicationView {
  if (status === "initializing") return "loading";
  if (status === "authenticated-profile-ready" && hasAuthorizedSession) return "dashboard";
  return "login";
}

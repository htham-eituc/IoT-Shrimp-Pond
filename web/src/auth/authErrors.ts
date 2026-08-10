export type AuthenticationErrorCode =
  | "invalid-credentials"
  | "network"
  | "configuration"
  | "profile-missing"
  | "role-denied"
  | "pond-invalid"
  | "profile-permission-denied"
  | "profile-invalid"
  | "unknown";

export class AuthenticationError extends Error {
  readonly name = "AuthenticationError";

  constructor(
    public readonly code: AuthenticationErrorCode,
    options?: { cause?: unknown },
  ) {
    super(`Authentication failed (${code}).`, options);
  }
}

export function normalizeFirebaseAuthError(reason: unknown): AuthenticationError {
  if (reason instanceof AuthenticationError) return reason;

  const code = readErrorCode(reason);
  if (INVALID_CREDENTIAL_CODES.has(code)) {
    return new AuthenticationError("invalid-credentials", { cause: reason });
  }
  if (NETWORK_CODES.has(code)) {
    return new AuthenticationError("network", { cause: reason });
  }
  if (CONFIGURATION_CODES.has(code)) {
    return new AuthenticationError("configuration", { cause: reason });
  }
  return new AuthenticationError("unknown", { cause: reason });
}

export function isFirebasePermissionDenied(reason: unknown): boolean {
  const code = readErrorCode(reason).toLowerCase();
  return code === "permission_denied"
    || code === "database/permission-denied"
    || code === "permission-denied";
}

function readErrorCode(reason: unknown): string {
  if (!reason || typeof reason !== "object" || !("code" in reason)) return "";
  return typeof reason.code === "string" ? reason.code : "";
}

const INVALID_CREDENTIAL_CODES = new Set([
  "auth/invalid-credential",
  "auth/invalid-email",
  "auth/invalid-login-credentials",
  "auth/user-disabled",
  "auth/user-not-found",
  "auth/wrong-password",
]);

const NETWORK_CODES = new Set([
  "auth/network-request-failed",
  "auth/too-many-requests",
  "auth/timeout",
]);

const CONFIGURATION_CODES = new Set([
  "auth/api-key-not-valid.-please-pass-a-valid-api-key.",
  "auth/configuration-not-found",
  "auth/invalid-api-key",
  "auth/invalid-app-credential",
  "auth/operation-not-allowed",
]);

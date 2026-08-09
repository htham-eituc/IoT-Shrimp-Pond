export type ConnectionState = "online" | "stale" | "offline";

export interface ConnectionPresentation {
  state: ConnectionState;
  label: "Online" | "Stale" | "Offline";
  tone: "normal" | "warning" | "offline";
}

export const DEFAULT_STALE_AFTER_MS = 30_000;

export function getConnectionPresentation(
  connected: boolean,
  lastSeenMs: number,
  currentTimeMs: number | null,
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
): ConnectionPresentation {
  if (!connected) return { state: "offline", label: "Offline", tone: "offline" };
  if (currentTimeMs !== null && currentTimeMs - lastSeenMs > staleAfterMs) {
    return { state: "stale", label: "Stale", tone: "warning" };
  }
  return { state: "online", label: "Online", tone: "normal" };
}

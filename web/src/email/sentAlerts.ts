const STORAGE_PREFIX = "shrimp-pond:gmail-sent";
const MAX_STORED_ALERTS = 200;

export function readSentAlertIds(userId: string, pondId: string): Set<string> {
  try {
    const value = localStorage.getItem(storageKey(userId, pondId));
    const parsed: unknown = value ? JSON.parse(value) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch { return new Set(); }
}

export function rememberSentAlert(userId: string, pondId: string, alertId: string): void {
  const ids = readSentAlertIds(userId, pondId);
  ids.delete(alertId);
  ids.add(alertId);
  try { localStorage.setItem(storageKey(userId, pondId), JSON.stringify([...ids].slice(-MAX_STORED_ALERTS))); }
  catch { /* Delivery succeeded even when browser storage is unavailable. */ }
}

function storageKey(userId: string, pondId: string): string { return `${STORAGE_PREFIX}:${userId}:${pondId}`; }

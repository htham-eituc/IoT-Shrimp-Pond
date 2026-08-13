export type ConnectionState = "online" | "offline";

export interface ConnectionPresentation {
  state: ConnectionState;
  tone: "normal" | "offline";
}

export function getConnectionPresentation(connected: boolean): ConnectionPresentation {
  if (!connected) return { state: "offline", tone: "offline" };
  return { state: "online", tone: "normal" };
}

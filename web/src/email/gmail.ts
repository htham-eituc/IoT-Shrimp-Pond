import type { KeyedRecord, PondAlert } from "../domain";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

interface GoogleTokenResponse { access_token?: string; expires_in?: number | string; error?: string; error_description?: string }
interface GoogleTokenClient { requestAccessToken(config?: { prompt?: string }): void }
interface GoogleIdentityServices {
  accounts: { oauth2: { initTokenClient(config: {
    client_id: string;
    scope: string;
    login_hint?: string;
    callback(response: GoogleTokenResponse): void;
    error_callback(error: { type?: string }): void;
  }): GoogleTokenClient } };
}

export interface GmailAccess { accessToken: string; expiresAtMs: number }
export interface CriticalAlertEmailInput {
  alert: KeyedRecord<PondAlert>;
  pondId: string;
  pondName: string;
  recipientEmail: string;
}

let identityScriptPromise: Promise<GoogleIdentityServices> | null = null;

export async function authorizeGmail(clientId: string, loginHint: string): Promise<GmailAccess> {
  const google = await loadGoogleIdentityServices();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SEND_SCOPE,
      login_hint: loginHint,
      callback: (response) => {
        if (!response.access_token) {
          reject(new Error(response.error_description || response.error || "gmailAuthorizationFailed"));
          return;
        }
        const lifetimeSeconds = Number(response.expires_in ?? 3_600);
        resolve({
          accessToken: response.access_token,
          expiresAtMs: Date.now() + Math.max(60, (Number.isFinite(lifetimeSeconds) ? lifetimeSeconds : 3_600) - 60) * 1_000,
        });
      },
      error_callback: (error) => reject(new Error(error.type || "gmailAuthorizationFailed")),
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

export function selectUnsentCriticalAlerts(alerts: Array<KeyedRecord<PondAlert>>, sentAlertIds: ReadonlySet<string>) {
  return alerts
    .filter(({ id, value }) => value.severity === "critical" && value.status === "active" && !sentAlertIds.has(id))
    .sort((left, right) => left.value.createdAtMs - right.value.createdAtMs);
}

export async function sendCriticalAlertEmail(accessToken: string, input: CriticalAlertEmailInput): Promise<void> {
  const { subject, text } = buildCriticalAlertEmail(input);
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: createRawMessage(input.recipientEmail, subject, text) }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    const error = new Error(body?.error?.message || `Gmail API returned HTTP ${response.status}.`);
    Object.assign(error, { status: response.status });
    throw error;
  }
}

export function buildCriticalAlertEmail(input: CriticalAlertEmailInput): { subject: string; text: string } {
  const { alert, pondId, pondName } = input;
  const title = formatAlertType(alert.value.type);
  const measurements = Object.entries(alert.value.measurements ?? {}).map(([name, value]) => `- ${name}: ${String(value)}`);
  return {
    subject: `[CRITICAL] ${pondName}: ${title}`,
    text: [
      "A critical shrimp pond alert requires attention.", "",
      `Pond: ${pondName} (${pondId})`, `Alert: ${title}`, `Content: ${alert.value.message}`,
      `Detected: ${new Date(alert.value.createdAtMs).toISOString()}`,
      ...(measurements.length ? ["", "Measurements:", ...measurements] : []),
      "", `Alert ID: ${alert.id}`, "Open the dashboard to inspect the pond and resolve the alert.",
    ].join("\n"),
  };
}

function loadGoogleIdentityServices(): Promise<GoogleIdentityServices> {
  const existing = getGoogleIdentityServices();
  if (existing) return Promise.resolve(existing);
  if (identityScriptPromise) return identityScriptPromise;
  identityScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const google = getGoogleIdentityServices();
      if (google) resolve(google);
      else reject(new Error("gmailLibraryUnavailable"));
    };
    script.onerror = () => reject(new Error("gmailLibraryUnavailable"));
    document.head.append(script);
  });
  return identityScriptPromise;
}

function getGoogleIdentityServices(): GoogleIdentityServices | null {
  return (window as Window & { google?: GoogleIdentityServices }).google ?? null;
}

function createRawMessage(to: string, subject: string, text: string): string {
  const headers = [
    `To: ${sanitizeHeader(to)}`,
    `Subject: =?UTF-8?B?${toBase64(subject)}?=`,
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64",
  ];
  return toBase64Url(`${headers.join("\r\n")}\r\n\r\n${toBase64(text)}`);
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function toBase64Url(value: string): string { return toBase64(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function sanitizeHeader(value: string): string { return value.replace(/[\r\n]/g, " ").trim(); }
function formatAlertType(type: string): string {
  return type.split("_").filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Mail, MailCheck, MailWarning } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { KeyedRecord, PondAlert } from "../domain";
import { authorizeGmail, selectUnsentCriticalAlerts, sendCriticalAlertEmail, type GmailAccess } from "../email/gmail";
import { readSentAlertIds, rememberSentAlert } from "../email/sentAlerts";

interface Props {
  alerts: Array<KeyedRecord<PondAlert>>;
  clientId?: string;
  pondId: string;
  pondName: string;
  recipientEmail: string | null;
  userId: string;
}
type ConnectionState = "idle" | "connecting" | "connected" | "sending" | "expired" | "authorizationError" | "sendError";

export function GmailAlertNotifier({ alerts, clientId, pondId, pondName, recipientEmail, userId }: Props) {
  const { t } = useTranslation("dashboard");
  const [access, setAccess] = useState<GmailAccess | null>(null);
  const [state, setState] = useState<ConnectionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const processingIds = useRef(new Set<string>());

  useEffect(() => {
    if (!access) return;
    const timer = window.setTimeout(() => {
      setAccess(null);
      setState("expired");
    }, Math.max(0, access.expiresAtMs - Date.now()));
    return () => window.clearTimeout(timer);
  }, [access]);

  useEffect(() => {
    if (!access || !recipientEmail || access.expiresAtMs <= Date.now()) return;
    const pending = selectUnsentCriticalAlerts(alerts, readSentAlertIds(userId, pondId))
      .filter(({ id }) => !processingIds.current.has(id));
    if (!pending.length) return;
    let cancelled = false;
    const send = async () => {
      setState("sending");
      for (const alert of pending) {
        if (cancelled) break;
        processingIds.current.add(alert.id);
        try {
          await sendCriticalAlertEmail(access.accessToken, { alert, pondId, pondName, recipientEmail });
          rememberSentAlert(userId, pondId, alert.id);
        } catch (error) {
          if ((error as { status?: number }).status === 401) { setAccess(null); setState("expired"); }
          else {
            setErrorMessage(error instanceof Error ? error.message : t("gmailAlerts.unknownSendError"));
            setState("sendError");
          }
          processingIds.current.delete(alert.id);
          return;
        }
        processingIds.current.delete(alert.id);
      }
      if (!cancelled) setState("connected");
    };
    void send();
    return () => { cancelled = true; };
  }, [access, alerts, pondId, pondName, recipientEmail, retryCount, t, userId]);

  async function connect() {
    if (!clientId || !recipientEmail || state === "connecting") return;
    if (access && state === "sendError") {
      setErrorMessage(null);
      setRetryCount((count) => count + 1);
      return;
    }
    setState("connecting");
    setErrorMessage(null);
    try { setAccess(await authorizeGmail(clientId, recipientEmail)); setState("connected"); }
    catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("gmailAlerts.authorizationFailed"));
      setState("authorizationError");
    }
  }

  const unavailable = !clientId || !recipientEmail;
  const label = unavailable ? t("gmailAlerts.unavailable")
    : state === "connecting" ? t("gmailAlerts.connecting")
      : state === "sending" ? t("gmailAlerts.sending")
        : state === "connected" ? t("gmailAlerts.connected")
          : state === "expired" ? t("gmailAlerts.reconnect")
            : state === "sendError" ? t("gmailAlerts.sendFailed")
              : state === "authorizationError" ? t("gmailAlerts.retry") : t("gmailAlerts.connect");
  const Icon = state === "connecting" || state === "sending" ? LoaderCircle
    : state === "connected" ? MailCheck : state === "sendError" || state === "authorizationError" ? MailWarning : Mail;
  const description = unavailable ? t("gmailAlerts.configurationHelp")
    : errorMessage ? t("gmailAlerts.errorDescription", { error: errorMessage })
      : t("gmailAlerts.description", { email: recipientEmail });

  return (
    <button
      className={`gmail-alert-button gmail-alert-button--${state}`}
      type="button"
      disabled={unavailable || state === "connecting" || state === "sending"}
      title={description}
      onClick={() => void connect()}
    >
      <Icon className={state === "connecting" || state === "sending" ? "spin" : undefined} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

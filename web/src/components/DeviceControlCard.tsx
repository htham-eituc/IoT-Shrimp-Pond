import { useState, type ReactNode } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, Power, TriangleAlert } from "lucide-react";
import type { CommandRecord, DeviceAction, DeviceName } from "../domain";

interface DeviceControlCardProps {
  device: DeviceName;
  name: string;
  description: string;
  icon: ReactNode;
  confirmedOn: boolean;
  latestCommand?: CommandRecord;
  referenceTimeMs: number;
  disabled?: boolean;
  onRequest: (device: DeviceName, action: DeviceAction) => Promise<unknown>;
}

export function DeviceControlCard({
  device,
  name,
  description,
  icon,
  confirmedOn,
  latestCommand,
  referenceTimeMs,
  disabled = false,
  onRequest,
}: DeviceControlCardProps) {
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const targetAction: DeviceAction = confirmedOn ? "off" : "on";
  const pending = latestCommand?.status === "pending";
  const confirming =
    latestCommand?.status === "completed" &&
    (latestCommand.action === "on") !== confirmedOn &&
    referenceTimeMs - (latestCommand.processedAtMs ?? 0) < 15_000;
  const busy = submitting || pending || confirming;

  async function requestAction() {
    setSubmitting(true);
    setRequestError(null);
    try {
      await onRequest(device, targetAction);
    } catch (reason) {
      setRequestError(reason instanceof Error ? reason.message : "Command could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className={`device-card${confirmedOn ? " device-card--active" : ""}`}>
      <div className="device-card__heading">
        <span className="device-card__icon" aria-hidden="true">{icon}</span>
        <span className={`device-state ${confirmedOn ? "device-state--on" : ""}`}>
          <i /> Confirmed {confirmedOn ? "on" : "off"}
        </span>
      </div>

      <div className="device-card__copy">
        <h3>{name}</h3>
        <p>{description}</p>
      </div>

      <button
        type="button"
        className="device-card__action"
        disabled={disabled || busy}
        onClick={() => void requestAction()}
        aria-describedby={`${device}-command-feedback`}
      >
        {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Power aria-hidden="true" />}
        {submitting
          ? "Creating request…"
          : pending
            ? `Requesting ${latestCommand.action}…`
            : confirming
              ? "Confirming feedback…"
              : `Turn ${targetAction}`}
        {!busy && <ArrowRight className="device-card__arrow" aria-hidden="true" />}
      </button>

      <div
        className="device-card__feedback"
        id={`${device}-command-feedback`}
        aria-live="polite"
      >
        {requestError ? (
          <span className="feedback feedback--error"><TriangleAlert aria-hidden="true" />{requestError}</span>
        ) : pending ? (
          <span className="feedback feedback--pending"><LoaderCircle className="spin" aria-hidden="true" />Pending · confirmed state is unchanged</span>
        ) : confirming ? (
          <span className="feedback feedback--pending"><LoaderCircle className="spin" aria-hidden="true" />Command completed · awaiting state feedback</span>
        ) : latestCommand?.status === "failed" ? (
          <span className="feedback feedback--error"><TriangleAlert aria-hidden="true" />Last request failed</span>
        ) : latestCommand?.status === "completed" &&
          (latestCommand.action === "on") === confirmedOn &&
          referenceTimeMs - (latestCommand.processedAtMs ?? 0) < 15_000 ? (
          <span className="feedback feedback--success"><CheckCircle2 aria-hidden="true" />Device feedback confirmed</span>
        ) : (
          <span className="feedback feedback--quiet">Actions create commands; the controller confirms state.</span>
        )}
      </div>
    </article>
  );
}

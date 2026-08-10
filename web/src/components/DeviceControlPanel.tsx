import { useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  Bell,
  CheckCircle2,
  Cpu,
  Droplets,
  Lightbulb,
  LoaderCircle,
  Power,
  Utensils,
  Wind,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  Command,
  CommandAction,
  KeyedRecord,
  OperatingMode,
  PondDevices,
  PondSettings,
} from "../domain";
import type { PondDataSource } from "../data";
import { translateError } from "../i18n";
import { useLocaleFormatters } from "../i18n/formatters";
import {
  CONTROLLABLE_DEVICES,
  READ_ONLY_DEVICES,
  hasPendingCommand,
  latestCommandForDevice,
  requestManualDeviceCommand,
  updateOperatingMode,
  type ControllableDevice,
  type ReadOnlyDevice,
} from "../control/deviceControl";
import { StatusBadge } from "./StatusBadge";

interface DeviceDefinition {
  icon: LucideIcon;
}

const DEVICE_DEFINITIONS: Record<ControllableDevice | ReadOnlyDevice, DeviceDefinition> = {
  aerator: {
    icon: Wind,
  },
  drainagePump: {
    icon: ArrowDown,
  },
  dilutionPump: {
    icon: Droplets,
  },
  feeder: {
    icon: Utensils,
  },
  buzzer: {
    icon: Bell,
  },
  warningBeacon: {
    icon: Lightbulb,
  },
};

interface DeviceControlPanelProps {
  dataSource: PondDataSource;
  pondId: string;
  connected: boolean;
  devices: PondDevices;
  settings: PondSettings;
  commands: Array<KeyedRecord<Command>>;
}

export function DeviceControlPanel({
  dataSource,
  pondId,
  connected,
  devices,
  settings,
  commands,
}: DeviceControlPanelProps) {
  const { t } = useTranslation(["common", "control", "errors"]);
  const [modeUpdating, setModeUpdating] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<Partial<Record<ControllableDevice, boolean>>>({});
  const [commandErrors, setCommandErrors] = useState<Partial<Record<ControllableDevice, string>>>({});
  const locallyPendingDevices = useRef(new Set<ControllableDevice>());

  async function changeMode(mode: OperatingMode) {
    if (mode === settings.mode || modeUpdating) return;
    setModeUpdating(true);
    setModeError(null);

    try {
      await updateOperatingMode(dataSource, pondId, mode);
    } catch (reason) {
      setModeError(translateError(reason, "modeUpdate", t));
    } finally {
      setModeUpdating(false);
    }
  }

  async function requestCommand(device: ControllableDevice, action: CommandAction) {
    if (locallyPendingDevices.current.has(device)) return;
    locallyPendingDevices.current.add(device);
    setSubmitting((current) => ({ ...current, [device]: true }));
    setCommandErrors((current) => ({ ...current, [device]: undefined }));

    try {
      await requestManualDeviceCommand({
        dataSource,
        pondId,
        mode: settings.mode,
        device,
        action,
        commands,
      });
    } catch (reason) {
      setCommandErrors((current) => ({
        ...current,
        [device]: translateError(reason, "commandCreate", t),
      }));
    } finally {
      locallyPendingDevices.current.delete(device);
      setSubmitting((current) => ({ ...current, [device]: false }));
    }
  }

  const automatic = settings.mode === "automatic";
  const controlsDisabledReason = automatic
    ? t("automaticDisabled", { ns: "control" })
    : !connected
      ? t("disconnectedDisabled", { ns: "control" })
      : null;

  return (
    <div className="view-stack">
      <div className="page-heading page-heading--with-trailing">
        <div>
          <span className="eyebrow">{t("eyebrow", { ns: "control" })}</span>
          <h1>{t("title", { ns: "control" })}</h1>
          <p>{t("description", { ns: "control" })}</p>
        </div>
        <StatusBadge label={t(`mode.${settings.mode}`, { ns: "common" })} tone={automatic ? "info" : "normal"} />
      </div>

      <section className="panel mode-panel" aria-labelledby="operating-mode-title">
        <div className="mode-panel__copy">
          <span className="mode-panel__icon" aria-hidden="true"><Cpu /></span>
          <div>
            <span className="eyebrow">{t("controllerBehavior", { ns: "control" })}</span>
            <h2 id="operating-mode-title">{t("operatingMode", { ns: "control" })}</h2>
            <p>
              {automatic
                ? t("automaticDescription", { ns: "control" })
                : t("manualDescription", { ns: "control" })}
            </p>
          </div>
        </div>

        <fieldset className="mode-selector" disabled={modeUpdating} aria-busy={modeUpdating}>
          <legend className="sr-only">{t("selectMode", { ns: "control" })}</legend>
          {(["automatic", "manual"] as const).map((mode) => (
            <label key={mode} className={settings.mode === mode ? "mode-option mode-option--active" : "mode-option"}>
              <input
                type="radio"
                name="operating-mode"
                value={mode}
                checked={settings.mode === mode}
                onChange={() => void changeMode(mode)}
              />
              <span>{t(`mode.${mode}`, { ns: "common" })}</span>
            </label>
          ))}
        </fieldset>

        <div className="mode-feedback" aria-live="polite">
          {modeUpdating && <><LoaderCircle className="spin" aria-hidden="true" /> {t("updatingSettings", { ns: "control" })}</>}
          {modeError && <span className="control-error" role="alert">{modeError}</span>}
        </div>
      </section>

      {controlsDisabledReason && (
        <div className={`state-panel state-panel--${automatic ? "info" : "offline"}`} role="status">
          <strong>{automatic ? t("automaticActive", { ns: "control" }) : t("controllerDisconnected", { ns: "control" })}</strong>
          <p>{controlsDisabledReason}</p>
        </div>
      )}

      <section aria-labelledby="manual-devices-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("commandEnabled", { ns: "control" })}</span>
            <h2 id="manual-devices-title">{t("manualControls", { ns: "control" })}</h2>
          </div>
          <span className="section-heading__note">{t("confirmedPath", { ns: "control", pondId })}</span>
        </div>

        <div className="device-grid">
          {CONTROLLABLE_DEVICES.map((device) => {
            const pending = hasPendingCommand(commands, device) || Boolean(submitting[device]);
            return (
              <DeviceCommandCard
                key={device}
                device={device}
                confirmedState={devices[device]}
                latestCommand={latestCommandForDevice(commands, device)}
                disabled={automatic || !connected || pending}
                pending={pending}
                error={commandErrors[device]}
                onRequest={(action) => void requestCommand(device, action)}
              />
            );
          })}
        </div>
      </section>

      <section aria-labelledby="safety-devices-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("safetyOutputs", { ns: "control" })}</span>
            <h2 id="safety-devices-title">{t("readOnlyState", { ns: "control" })}</h2>
          </div>
          <span className="section-heading__note">{t("noWebControls", { ns: "control" })}</span>
        </div>
        <div className="device-grid device-grid--readonly">
          {READ_ONLY_DEVICES.map((device) => (
            <ReadOnlyDeviceCard key={device} device={device} confirmedState={devices[device]} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DeviceCommandCard({
  device,
  confirmedState,
  latestCommand,
  disabled,
  pending,
  error,
  onRequest,
}: {
  device: ControllableDevice;
  confirmedState: boolean;
  latestCommand: KeyedRecord<Command> | null;
  disabled: boolean;
  pending: boolean;
  error?: string;
  onRequest(action: CommandAction): void;
}) {
  const { t } = useTranslation(["control", "devices"]);
  const definition = DEVICE_DEFINITIONS[device];
  const Icon = definition.icon;
  const label = t(`${device}.label`, { ns: "devices" });

  return (
    <article className={confirmedState ? "device-card device-card--active" : "device-card"}>
      <div className="device-card__header">
        <span className="device-card__icon" aria-hidden="true"><Icon /></span>
        <StatusBadge label={t(confirmedState ? "confirmedOn" : "confirmedOff", { ns: "control" })} tone={confirmedState ? "normal" : "offline"} />
      </div>
      <div>
        <h3>{label}</h3>
        <p>{t(`${device}.description`, { ns: "devices" })}</p>
      </div>

      <div className="device-actions" aria-label={t("commandsAriaLabel", { ns: "control", device: label })}>
        <button
          type="button"
          className="device-action device-action--on"
          disabled={disabled || confirmedState}
          onClick={() => onRequest("on")}
        >
          <Power aria-hidden="true" /> {t("turnOn", { ns: "control" })}
        </button>
        <button
          type="button"
          className="device-action device-action--off"
          disabled={disabled || !confirmedState}
          onClick={() => onRequest("off")}
        >
          {t("turnOff", { ns: "control" })}
        </button>
      </div>

      <CommandFeedback command={latestCommand} pending={pending} error={error} />
    </article>
  );
}

function ReadOnlyDeviceCard({ device, confirmedState }: { device: ReadOnlyDevice; confirmedState: boolean }) {
  const { t } = useTranslation(["common", "control", "devices"]);
  const definition = DEVICE_DEFINITIONS[device];
  const Icon = definition.icon;

  return (
    <article className={confirmedState ? "device-card device-card--active device-card--readonly" : "device-card device-card--readonly"}>
      <div className="device-card__header">
        <span className="device-card__icon" aria-hidden="true"><Icon /></span>
        <StatusBadge label={t(`action.${confirmedState ? "on" : "off"}`, { ns: "common" })} tone={confirmedState ? "warning" : "offline"} />
      </div>
      <div>
        <h3>{t(`${device}.label`, { ns: "devices" })}</h3>
        <p>{t(`${device}.description`, { ns: "devices" })}</p>
      </div>
      <span className="read-only-label">{t("readOnlyReported", { ns: "control" })}</span>
    </article>
  );
}

function CommandFeedback({
  command,
  pending,
  error,
}: {
  command: KeyedRecord<Command> | null;
  pending: boolean;
  error?: string;
}) {
  const { t } = useTranslation(["common", "control"]);
  const formatters = useLocaleFormatters();
  if (error) {
    return <div className="command-feedback command-feedback--failed" role="alert"><XCircle aria-hidden="true" /> <span>{error}</span></div>;
  }

  if (!command && !pending) {
    return <div className="command-feedback command-feedback--idle"><span>{t("noCommand", { ns: "control" })}</span></div>;
  }

  const status = pending ? "pending" : command?.value.status;
  const action = command?.value.action;
  const timestampMs = command?.value.processedAtMs ?? command?.value.createdAtMs;
  const content: Record<NonNullable<typeof status>, { icon: ReactNode; label: string }> = {
    pending: {
      icon: <LoaderCircle className="spin" aria-hidden="true" />,
      label: action ? t("requesting", { ns: "control", action: t(`action.${action}`, { ns: "common" }) }) : t("pending", { ns: "control" }),
    },
    completed: {
      icon: <CheckCircle2 aria-hidden="true" />,
      label: t("completed", { ns: "control", action: action ? t(`action.${action}`, { ns: "common" }) : "" }),
    },
    failed: {
      icon: <XCircle aria-hidden="true" />,
      label: t("failed", { ns: "control", action: action ? t(`action.${action}`, { ns: "common" }) : "" }),
    },
  };
  const feedback = status ? content[status] : content.pending;

  return (
    <div className={`command-feedback command-feedback--${status ?? "pending"}`} role={status === "failed" ? "alert" : undefined} aria-live="polite">
      {feedback.icon}
      <span>
        <strong>{feedback.label}</strong>
        {timestampMs !== undefined && (
          <time dateTime={new Date(timestampMs).toISOString()}>{formatters.timestamp(timestampMs)}</time>
        )}
      </span>
    </div>
  );
}

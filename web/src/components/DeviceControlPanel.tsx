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
import type {
  Command,
  CommandAction,
  KeyedRecord,
  OperatingMode,
  PondDevices,
  PondSettings,
} from "../domain";
import type { PondDataSource } from "../data";
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
  label: string;
  description: string;
  icon: LucideIcon;
}

const DEVICE_DEFINITIONS: Record<ControllableDevice | ReadOnlyDevice, DeviceDefinition> = {
  aerator: {
    label: "Aerator",
    description: "Adds oxygen by circulating pond water.",
    icon: Wind,
  },
  drainagePump: {
    label: "Drainage pump",
    description: "Removes water during high-level conditions.",
    icon: ArrowDown,
  },
  dilutionPump: {
    label: "Dilution pump",
    description: "Adds lower-salinity water to the pond.",
    icon: Droplets,
  },
  feeder: {
    label: "Feeder",
    description: "Controls the pond's feeding mechanism.",
    icon: Utensils,
  },
  buzzer: {
    label: "Alarm buzzer",
    description: "Controller-owned audible warning output.",
    icon: Bell,
  },
  warningBeacon: {
    label: "Warning beacon",
    description: "Controller-owned visual warning output.",
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
      setModeError(reason instanceof Error ? reason.message : "Could not update operating mode.");
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
        [device]: reason instanceof Error ? reason.message : "Could not create the command.",
      }));
    } finally {
      locallyPendingDevices.current.delete(device);
      setSubmitting((current) => ({ ...current, [device]: false }));
    }
  }

  const automatic = settings.mode === "automatic";
  const controlsDisabledReason = automatic
    ? "Manual controls are disabled. The IoT controller owns automatic responses in automatic mode."
    : !connected
      ? "Manual controls are unavailable while the IoT controller is disconnected."
      : null;

  return (
    <div className="view-stack">
      <div className="page-heading page-heading--with-trailing">
        <div>
          <span className="eyebrow">Remote control</span>
          <h1>Operating mode and devices</h1>
          <p>Commands request an action; confirmed ON/OFF state always comes back from the IoT controller.</p>
        </div>
        <StatusBadge label={automatic ? "Automatic" : "Manual"} tone={automatic ? "info" : "normal"} />
      </div>

      <section className="panel mode-panel" aria-labelledby="operating-mode-title">
        <div className="mode-panel__copy">
          <span className="mode-panel__icon" aria-hidden="true"><Cpu /></span>
          <div>
            <span className="eyebrow">Controller behavior</span>
            <h2 id="operating-mode-title">Operating mode</h2>
            <p>
              {automatic
                ? "Automatic workflows evaluate configured thresholds and operate actuators on the device."
                : "Manual commands are sent to the device and remain pending until controller feedback arrives."}
            </p>
          </div>
        </div>

        <fieldset className="mode-selector" disabled={modeUpdating} aria-busy={modeUpdating}>
          <legend className="sr-only">Select operating mode</legend>
          {(["automatic", "manual"] as const).map((mode) => (
            <label key={mode} className={settings.mode === mode ? "mode-option mode-option--active" : "mode-option"}>
              <input
                type="radio"
                name="operating-mode"
                value={mode}
                checked={settings.mode === mode}
                onChange={() => void changeMode(mode)}
              />
              <span>{titleCase(mode)}</span>
            </label>
          ))}
        </fieldset>

        <div className="mode-feedback" aria-live="polite">
          {modeUpdating && <><LoaderCircle className="spin" aria-hidden="true" /> Updating settings…</>}
          {modeError && <span className="control-error" role="alert">{modeError}</span>}
        </div>
      </section>

      {controlsDisabledReason && (
        <div className={`state-panel state-panel--${automatic ? "info" : "offline"}`} role="status">
          <strong>{automatic ? "Automatic control is active" : "Controller disconnected"}</strong>
          <p>{controlsDisabledReason}</p>
        </div>
      )}

      <section aria-labelledby="manual-devices-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Command-enabled actuators</span>
            <h2 id="manual-devices-title">Manual device controls</h2>
          </div>
          <span className="section-heading__note">Confirmed state from ponds/{pondId}/devices</span>
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
            <span className="eyebrow">Safety outputs</span>
            <h2 id="safety-devices-title">Read-only controller state</h2>
          </div>
          <span className="section-heading__note">No web controls are exposed</span>
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
  const definition = DEVICE_DEFINITIONS[device];
  const Icon = definition.icon;

  return (
    <article className={confirmedState ? "device-card device-card--active" : "device-card"}>
      <div className="device-card__header">
        <span className="device-card__icon" aria-hidden="true"><Icon /></span>
        <StatusBadge label={confirmedState ? "Confirmed ON" : "Confirmed OFF"} tone={confirmedState ? "normal" : "offline"} />
      </div>
      <div>
        <h3>{definition.label}</h3>
        <p>{definition.description}</p>
      </div>

      <div className="device-actions" aria-label={`${definition.label} commands`}>
        <button
          type="button"
          className="device-action device-action--on"
          disabled={disabled || confirmedState}
          onClick={() => onRequest("on")}
        >
          <Power aria-hidden="true" /> Turn on
        </button>
        <button
          type="button"
          className="device-action device-action--off"
          disabled={disabled || !confirmedState}
          onClick={() => onRequest("off")}
        >
          Turn off
        </button>
      </div>

      <CommandFeedback command={latestCommand} pending={pending} error={error} />
    </article>
  );
}

function ReadOnlyDeviceCard({ device, confirmedState }: { device: ReadOnlyDevice; confirmedState: boolean }) {
  const definition = DEVICE_DEFINITIONS[device];
  const Icon = definition.icon;

  return (
    <article className={confirmedState ? "device-card device-card--active device-card--readonly" : "device-card device-card--readonly"}>
      <div className="device-card__header">
        <span className="device-card__icon" aria-hidden="true"><Icon /></span>
        <StatusBadge label={confirmedState ? "ON" : "OFF"} tone={confirmedState ? "warning" : "offline"} />
      </div>
      <div>
        <h3>{definition.label}</h3>
        <p>{definition.description}</p>
      </div>
      <span className="read-only-label">Read only · reported by controller</span>
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
  if (error) {
    return <div className="command-feedback command-feedback--failed" role="alert"><XCircle aria-hidden="true" /> <span>{error}</span></div>;
  }

  if (!command && !pending) {
    return <div className="command-feedback command-feedback--idle"><span>No command requested in this session.</span></div>;
  }

  const status = pending ? "pending" : command?.value.status;
  const action = command?.value.action;
  const timestampMs = command?.value.processedAtMs ?? command?.value.createdAtMs;
  const content: Record<NonNullable<typeof status>, { icon: ReactNode; label: string }> = {
    pending: {
      icon: <LoaderCircle className="spin" aria-hidden="true" />,
      label: `Pending${action ? ` · requesting ${action.toUpperCase()}` : ""}`,
    },
    completed: {
      icon: <CheckCircle2 aria-hidden="true" />,
      label: `Completed · requested ${action?.toUpperCase()}`,
    },
    failed: {
      icon: <XCircle aria-hidden="true" />,
      label: `Failed · requested ${action?.toUpperCase()}`,
    },
  };
  const feedback = status ? content[status] : content.pending;

  return (
    <div className={`command-feedback command-feedback--${status ?? "pending"}`} aria-live="polite">
      {feedback.icon}
      <span>
        <strong>{feedback.label}</strong>
        {timestampMs !== undefined && (
          <time dateTime={new Date(timestampMs).toISOString()}>{formatTimestamp(timestampMs)}</time>
        )}
      </span>
    </div>
  );
}

function formatTimestamp(timestampMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestampMs);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

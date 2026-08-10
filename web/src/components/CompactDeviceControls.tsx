import { useRef, useState } from "react";
import {
  ArrowDown,
  Bell,
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
import type { Command, CommandAction, CommandDevice, KeyedRecord, OperatingMode, PondDevices, PondSettings } from "../domain";
import type { PondDataSource } from "../data";
import {
  CONTROLLABLE_DEVICES,
  READ_ONLY_DEVICES,
  hasPendingCommand,
  latestCommandForDevice,
  requestManualDeviceCommand,
  updateOperatingMode,
  type ControllableDevice,
} from "../control/deviceControl";
import { translateError } from "../i18n";
import { StatusBadge } from "./StatusBadge";

const DEVICE_ICONS = {
  aerator: Wind,
  drainagePump: ArrowDown,
  dilutionPump: Droplets,
  feeder: Utensils,
  buzzer: Bell,
  warningBeacon: Lightbulb,
} satisfies Record<keyof PondDevices, LucideIcon>;

interface CompactDeviceControlsProps {
  dataSource: PondDataSource;
  pondId: string;
  connected: boolean;
  devices: PondDevices;
  settings: PondSettings;
  commands: Array<KeyedRecord<Command>>;
  highlightedDevice: CommandDevice | null;
  onOpenDetails(): void;
}

export function CompactDeviceControls({
  dataSource,
  pondId,
  connected,
  devices,
  settings,
  commands,
  highlightedDevice,
  onOpenDetails,
}: CompactDeviceControlsProps) {
  const { t } = useTranslation(["common", "control", "devices", "errors"]);
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
      await requestManualDeviceCommand({ dataSource, pondId, mode: settings.mode, device, action, commands });
    } catch (reason) {
      setCommandErrors((current) => ({ ...current, [device]: translateError(reason, "commandCreate", t) }));
    } finally {
      locallyPendingDevices.current.delete(device);
      setSubmitting((current) => ({ ...current, [device]: false }));
    }
  }

  const automatic = settings.mode === "automatic";

  return (
    <section className={`command-devices command-devices--${settings.mode}`} aria-labelledby="command-devices-title">
      <header className="command-section-heading">
        <div>
          <span className="eyebrow">{t("commandEnabled", { ns: "control" })}</span>
          <h2 id="command-devices-title">{t("deviceStates", { ns: "control" })}</h2>
        </div>
        <fieldset className="mode-selector mode-selector--compact" disabled={modeUpdating} aria-busy={modeUpdating}>
          <legend className="sr-only">{t("selectMode", { ns: "control" })}</legend>
          {(["automatic", "manual"] as const).map((mode) => (
            <label key={mode} className={settings.mode === mode ? "mode-option mode-option--active" : "mode-option"}>
              <input
                type="radio"
                name="command-center-operating-mode"
                value={mode}
                checked={settings.mode === mode}
                onChange={() => void changeMode(mode)}
              />
              <span>{t(`mode.${mode}`, { ns: "common" })}</span>
            </label>
          ))}
        </fieldset>
        <button className="command-link" type="button" onClick={onOpenDetails}>
          {t("deviceDetails", { ns: "control" })}
        </button>
      </header>

      {modeError && <p className="compact-control-error" role="alert">{modeError}</p>}
      <div className="compact-device-grid">
        {CONTROLLABLE_DEVICES.map((device) => {
          const confirmedState = devices[device];
          const pending = hasPendingCommand(commands, device) || Boolean(submitting[device]);
          const latestCommand = latestCommandForDevice(commands, device);
          const nextAction: CommandAction = confirmedState ? "off" : "on";
          const Icon = DEVICE_ICONS[device];
          const deviceClasses = [
            "compact-device",
            confirmedState ? "compact-device--active" : "",
            pending ? "compact-device--pending" : "",
            latestCommand?.value.status === "failed" ? "compact-device--failed" : "",
            highlightedDevice === device ? "compact-device--highlighted" : "",
          ].filter(Boolean).join(" ");
          return (
            <article key={device} id={`command-device-${device}`} className={deviceClasses} tabIndex={-1}>
              <Icon aria-hidden="true" />
              <div className="compact-device__identity">
                <strong>{t(`${device}.label`, { ns: "devices" })}</strong>
                <StatusBadge
                  label={t(`action.${confirmedState ? "on" : "off"}`, { ns: "common" })}
                  tone={confirmedState ? "normal" : "offline"}
                />
              </div>
              <button
                type="button"
                className="compact-device__action"
                disabled={automatic || !connected || pending}
                onClick={() => void requestCommand(device, nextAction)}
                aria-label={t("commandsAriaLabel", { ns: "control", device: t(`${device}.label`, { ns: "devices" }) })}
                title={automatic ? t("automaticHelper", { ns: "control" }) : undefined}
              >
                {pending ? <LoaderCircle className="spin" aria-hidden="true" /> : <Power aria-hidden="true" />}
                {pending ? t("pending", { ns: "control" }) : t(nextAction === "on" ? "turnOn" : "turnOff", { ns: "control" })}
              </button>
              {pending && (
                <small className="compact-device__command compact-device__command--pending" aria-live="polite">
                  <LoaderCircle className="spin" aria-hidden="true" /> {t("pending", { ns: "control" })}
                </small>
              )}
              {!pending && latestCommand && (
                <small
                  className={`compact-device__command compact-device__command--${latestCommand.value.status}`}
                  role={latestCommand.value.status === "failed" ? "alert" : undefined}
                >
                  {t(`status.${latestCommand.value.status}`, { ns: "common" })}
                </small>
              )}
              {commandErrors[device] && (
                <small className="compact-device__command compact-device__command--failed" role="alert">
                  <XCircle aria-hidden="true" /> {commandErrors[device]}
                </small>
              )}
            </article>
          );
        })}

        {READ_ONLY_DEVICES.map((device) => {
          const confirmedState = devices[device];
          const Icon = DEVICE_ICONS[device];
          return (
            <article
              key={device}
              id={`command-device-${device}`}
              className={`${confirmedState ? "compact-device compact-device--warning" : "compact-device"}${highlightedDevice === device ? " compact-device--highlighted" : ""}`}
              tabIndex={-1}
            >
              <Icon aria-hidden="true" />
              <div className="compact-device__identity">
                <strong>{t(`${device}.label`, { ns: "devices" })}</strong>
                <StatusBadge
                  label={t(`action.${confirmedState ? "on" : "off"}`, { ns: "common" })}
                  tone={confirmedState ? "warning" : "offline"}
                />
              </div>
              <small className="compact-device__readonly">{t("readOnly", { ns: "control" })}</small>
            </article>
          );
        })}
      </div>
      {automatic && <p className="command-devices__notice">{t("automaticHelper", { ns: "control" })}</p>}
      {!automatic && connected && <p className="command-devices__notice command-devices__notice--manual">{t("manualHelper", { ns: "control" })}</p>}
      {!connected && <p className="command-devices__notice command-devices__notice--warning">{t("disconnectedDisabled", { ns: "control" })}</p>}
    </section>
  );
}

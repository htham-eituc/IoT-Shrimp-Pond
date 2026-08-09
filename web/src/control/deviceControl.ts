import type {
  Command,
  CommandAction,
  CommandDevice,
  KeyedRecord,
  OperatingMode,
  PondSettings,
} from "../domain";
import type { PondDataSource } from "../data";

export const CONTROLLABLE_DEVICES = ["aerator", "drainagePump", "dilutionPump", "feeder"] as const;
export const READ_ONLY_DEVICES = ["buzzer", "warningBeacon"] as const;

export type ControllableDevice = (typeof CONTROLLABLE_DEVICES)[number];
export type ReadOnlyDevice = (typeof READ_ONLY_DEVICES)[number];

type CommandWriter = Pick<PondDataSource, "createCommand">;
type SettingsWriter = Pick<PondDataSource, "updateSettings">;

export interface ManualCommandRequest {
  dataSource: CommandWriter;
  pondId: string;
  mode: OperatingMode;
  device: ControllableDevice;
  action: CommandAction;
  commands: Array<KeyedRecord<Command>>;
  locallyPendingDevices?: ReadonlySet<CommandDevice>;
  now?: () => number;
}

export async function requestManualDeviceCommand({
  dataSource,
  pondId,
  mode,
  device,
  action,
  commands,
  locallyPendingDevices,
  now = () => Date.now(),
}: ManualCommandRequest): Promise<KeyedRecord<Command>> {
  if (mode !== "manual") {
    throw new Error("Manual commands are available only in manual mode.");
  }

  if (locallyPendingDevices?.has(device) || hasPendingCommand(commands, device)) {
    throw new Error("A command is already pending for this device.");
  }

  return dataSource.createCommand(pondId, {
    device,
    action,
    createdAtMs: now(),
  });
}

export function updateOperatingMode(
  dataSource: SettingsWriter,
  pondId: string,
  mode: OperatingMode,
): Promise<PondSettings> {
  return dataSource.updateSettings(pondId, { mode });
}

export function hasPendingCommand(commands: Array<KeyedRecord<Command>>, device: CommandDevice): boolean {
  return commands.some((command) => command.value.device === device && command.value.status === "pending");
}

export function latestCommandForDevice(
  commands: Array<KeyedRecord<Command>>,
  device: CommandDevice,
): KeyedRecord<Command> | null {
  let latest: KeyedRecord<Command> | null = null;

  for (const command of commands) {
    if (command.value.device !== device) continue;
    if (!latest || command.value.createdAtMs > latest.value.createdAtMs) {
      latest = command;
    }
  }

  return latest;
}

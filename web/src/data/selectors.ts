import type { CommandDevice, PondSensors } from "../domain";
import i18n from "../i18n";

export function getSensorDisplayName(sensor: keyof PondSensors): string {
  return i18n.t(`${sensor}.label`, { ns: "sensors" });
}

export function getDeviceDisplayName(device: CommandDevice): string {
  return i18n.t(`${device}.label`, { ns: "devices" });
}

export const sensorDisplayNames: Record<keyof PondSensors, string> = {
  get ph() { return getSensorDisplayName("ph"); },
  get do() { return getSensorDisplayName("do"); },
  get temperature() { return getSensorDisplayName("temperature"); },
  get waterLevel() { return getSensorDisplayName("waterLevel"); },
  get rain() { return getSensorDisplayName("rain"); },
  get ec() { return getSensorDisplayName("ec"); },
  get salinity() { return getSensorDisplayName("salinity"); },
};

export const deviceDisplayNames: Record<CommandDevice, string> = {
  get aerator() { return getDeviceDisplayName("aerator"); },
  get drainagePump() { return getDeviceDisplayName("drainagePump"); },
  get dilutionPump() { return getDeviceDisplayName("dilutionPump"); },
  get feeder() { return getDeviceDisplayName("feeder"); },
  get buzzer() { return getDeviceDisplayName("buzzer"); },
  get warningBeacon() { return getDeviceDisplayName("warningBeacon"); },
};

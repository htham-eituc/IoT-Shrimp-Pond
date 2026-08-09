import type { CommandDevice, PondSensors } from "../domain";

export const sensorDisplayNames = {
  ph: "pH",
  do: "Oxy hoa tan",
  temperature: "Nhiet do",
  waterLevel: "Muc nuoc",
  rain: "Mua",
  ec: "EC",
  salinity: "Do man",
} satisfies Record<keyof PondSensors, string>;

export const deviceDisplayNames = {
  aerator: "Quat suc khi",
  drainagePump: "Bom xa",
  dilutionPump: "Bom pha loang",
  feeder: "May cho an",
  buzzer: "Coi bao dong",
  warningBeacon: "Den canh bao",
} satisfies Record<CommandDevice, string>;

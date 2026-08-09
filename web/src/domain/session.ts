import type { OperatingMode, UserProfile } from "./pond";

export type FarmerProfile = UserProfile & { role: "farmer" };

export interface PondShellState {
  id: string;
  name: string;
  connected: boolean;
  mode: OperatingMode;
}

export interface DashboardSession {
  profile: FarmerProfile;
  pond: PondShellState;
}

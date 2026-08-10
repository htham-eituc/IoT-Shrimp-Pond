import type { OperatingMode, UserProfile } from "./pond";

export type FarmerProfile = UserProfile & { role: "farmer" };

export interface AuthenticatedFarmer {
  uid: string;
  email: string | null;
  displayName: string;
  role: "farmer";
  pondId: string;
}

export interface PondShellState {
  id: string;
  name: string;
  connected: boolean;
  mode: OperatingMode;
}

export interface DashboardSession {
  user: AuthenticatedFarmer;
  pond: PondShellState;
}

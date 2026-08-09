export type UserRole = "farmer" | "device";

export interface FarmerProfile {
  role: "farmer";
  pondId: string;
  displayName: string;
}

export interface PondShellState {
  id: string;
  name: string;
  connected: boolean;
  mode: "automatic" | "manual";
}

export interface DashboardSession {
  profile: FarmerProfile;
  pond: PondShellState;
}

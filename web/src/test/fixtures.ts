import type { PondAccessContext } from "../data";
import type { DashboardSession } from "../domain/session";

export const TEST_FARMER_ACCESS: PondAccessContext = {
  profile: {
    role: "farmer",
    pondId: "pond-001",
    displayName: "Test Pond Operator",
  },
};

export function createTestDashboardSession(): DashboardSession {
  return {
    user: {
      uid: "firebase-test-farmer-uid",
      email: "farmer@pond.test",
      ...TEST_FARMER_ACCESS.profile,
    },
    pond: {
      id: "pond-001",
      name: "Test Shrimp Pond 001",
      connected: true,
      mode: "automatic",
    },
  };
}

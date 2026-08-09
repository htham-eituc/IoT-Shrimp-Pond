import type { PondDatabaseRoot, TelemetryRecord } from "../domain";

export const MOCK_NOW_MS = Date.UTC(2026, 7, 10, 1, 0, 0);

export function createMockPondDatabase(nowMs = MOCK_NOW_MS): PondDatabaseRoot {
  const telemetry = createTelemetry(nowMs);

  return {
    users: {
      "mock-farmer-uid": {
        role: "farmer",
        pondId: "pond-001",
        displayName: "Pond Operator",
      },
      "mock-device-uid": {
        role: "device",
        pondId: "pond-001",
        displayName: "Pond Controller",
      },
    },
    ponds: {
      "pond-001": {
        name: "Smart Shrimp Pond 001",
        status: "normal",
        connected: true,
        lastSeenMs: nowMs - 12_000,
        sensors: {
          ph: 7.8,
          do: 5.7,
          temperature: 30.1,
          waterLevel: 72,
          rain: false,
          ec: 18.6,
          salinity: 20.4,
        },
        devices: {
          aerator: false,
          drainagePump: false,
          dilutionPump: false,
          feeder: true,
          buzzer: false,
          warningBeacon: false,
        },
      },
    },
    settings: {
      "pond-001": {
        mode: "automatic",
        thresholds: {
          ph: {
            normalMin: 7.5,
            normalMax: 8.5,
            warningLow: 7.5,
            warningHigh: 8.8,
          },
          do: {
            normalMin: 5,
            hypoxia: 4,
            critical: 3.5,
            recovery: 5.5,
            triggerDurationSec: 30,
          },
          temperature: {
            normalMin: 28,
            normalMax: 32,
            warningLow: 25,
            warningHigh: 33,
          },
          salinity: {
            normalMin: 10,
            normalMax: 25,
            warningLow: 5,
            warningHigh: 30,
          },
          waterLevel: {
            normalMin: 40,
            normalMax: 80,
            warningLow: 30,
            warningHigh: 90,
            overflowTriggerDurationSec: 10,
          },
        },
        automation: {
          hypoxiaResponseEnabled: true,
          rainOverflowResponseEnabled: true,
          heatSalinityResponseEnabled: true,
        },
      },
    },
    commands: {
      "pond-001": {},
    },
    telemetry: {
      "pond-001": Object.fromEntries(telemetry.map((record) => [String(record.timestampMs), record])),
    },
    alerts: {
      "pond-001": {
        "alert-heat-001": {
          type: "heat_salinity",
          severity: "warning",
          status: "resolved",
          message: "Temperature and salinity briefly exceeded configured limits.",
          measurements: {
            temperature: 33.4,
            salinity: 30.8,
          },
          createdAtMs: nowMs - 3_600_000,
          resolvedAtMs: nowMs - 3_060_000,
        },
      },
    },
    events: {
      "pond-001": {
        "event-connection-001": {
          type: "connection",
          source: "automatic",
          reason: "controller_online",
          createdAtMs: nowMs - 120_000,
        },
        "event-workflow-001": {
          type: "workflow_resolved",
          source: "automatic",
          reason: "heat_salinity",
          createdAtMs: nowMs - 3_060_000,
        },
      },
    },
  };
}

function createTelemetry(nowMs: number): TelemetryRecord[] {
  return Array.from({ length: 12 }, (_, index) => {
    const sampleIndex = 11 - index;
    return {
      timestampMs: nowMs - sampleIndex * 300_000,
      ph: round(7.72 + index * 0.01, 2),
      do: round(5.45 + index * 0.03, 2),
      temperature: round(29.4 + index * 0.06, 2),
      waterLevel: 70 + Math.round(index / 4),
      rain: false,
      ec: round(18.2 + index * 0.04, 2),
      salinity: round(20 + index * 0.03, 2),
    };
  });
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

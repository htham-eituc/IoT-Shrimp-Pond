import { describe, expect, it } from "vitest";
import { parseMqttSensorMessage } from "./mqttSensors";

const message = {
  version: 1,
  pondId: "pond-001",
  deviceId: "pond-controller-001",
  bootId: "boot-a",
  sequence: 1,
  timestampMs: 1_786_200_100_000,
  sensors: {
    ph: 7.4,
    do: 3.7,
    temperature: 30.1,
    waterLevel: 72,
    rain: false,
    ec: 19.1,
    salinity: 20.8,
  },
};

describe("MQTT sensor message parser", () => {
  it("accepts the versioned sensor payload for the subscribed pond", () => {
    expect(parseMqttSensorMessage(JSON.stringify(message), "pond-001")).toMatchObject({
      pondId: "pond-001",
      sequence: 1,
      sensors: { do: 3.7 },
    });
  });

  it("rejects messages for another pond and invalid sensor data", () => {
    expect(parseMqttSensorMessage(JSON.stringify({ ...message, pondId: "pond-002" }), "pond-001")).toBeNull();
    expect(parseMqttSensorMessage(JSON.stringify({ ...message, sensors: { ...message.sensors, ph: 20 } }), "pond-001")).toBeNull();
  });
});

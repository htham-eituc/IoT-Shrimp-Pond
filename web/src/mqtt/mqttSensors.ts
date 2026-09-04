import mqtt, { type MqttClient } from "mqtt";
import { useEffect, useState } from "react";
import { getFirebaseClient, readFirebaseConfig } from "../firebase/client";
import type { PondSensors } from "../domain";

const MQTT_TOPIC_PREFIX = "shrimp-pond/v1/ponds";
const MQTT_STALE_AFTER_MS = 15_000;

export interface MqttSensorSnapshot {
  pondId: string;
  bootId: string;
  sequence: number;
  timestampMs: number;
  sensors: PondSensors;
}

interface MqttConfig {
  url: string;
  credentials: MqttCredentials | { credentialEndpoint: string };
}

interface MqttCredentials {
  username: string;
  password: string;
}

export function useMqttSensors(pondId: string): MqttSensorSnapshot | null {
  const [snapshot, setSnapshot] = useState<MqttSensorSnapshot | null>(null);

  useEffect(() => {
    let config: MqttConfig | null;
    try {
      config = readMqttConfig(import.meta.env);
    } catch (reason) {
      console.error("MQTT live sensor overlay is disabled.", reason);
      setSnapshot(null);
      return;
    }
    if (!config) {
      setSnapshot(null);
      return;
    }

    let active = true;
    let client: MqttClient | null = null;
    const topic = `${MQTT_TOPIC_PREFIX}/${pondId}/sensors`;

    void getCredentials(config.credentials, pondId)
      .then((credentials) => {
        if (!active) return;
        client = mqtt.connect(config.url, {
          clean: true,
          clientId: `pond-web-${crypto.randomUUID()}`,
          username: credentials.username,
          password: credentials.password,
          protocolVersion: 5,
          reconnectPeriod: 5_000,
        });
        client.on("connect", () => client?.subscribe(topic, { qos: 1 }));
        client.on("message", (receivedTopic, payload) => {
          if (!active || receivedTopic !== topic) return;
          const next = parseMqttSensorMessage(payload.toString(), pondId);
          if (!next) return;
          setSnapshot((current) => isNewerSnapshot(next, current) ? next : current);
        });
      })
      .catch(() => {
        // MQTT is an optional live overlay. Firebase remains available on failure.
        if (active) setSnapshot(null);
      });

    const staleTimer = window.setInterval(() => {
      setSnapshot((current) => current && Date.now() - current.timestampMs > MQTT_STALE_AFTER_MS ? null : current);
    }, 1_000);

    return () => {
      active = false;
      window.clearInterval(staleTimer);
      client?.end(true);
      setSnapshot(null);
    };
  }, [pondId]);

  return snapshot;
}

export function overlayMqttSensors<T extends { sensors: PondSensors }>(pond: T | null, snapshot: MqttSensorSnapshot | null): T | null {
  if (!pond || !snapshot || Date.now() - snapshot.timestampMs > MQTT_STALE_AFTER_MS) return pond;
  return { ...pond, sensors: snapshot.sensors };
}

function readMqttConfig(environment: Record<string, string | boolean | undefined>): MqttConfig | null {
  const url = environment.VITE_MQTT_WSS_URL;
  const credentialEndpoint = environment.VITE_MQTT_CREDENTIAL_ENDPOINT;
  const username = environment.VITE_MQTT_DASHBOARD_USERNAME;
  const password = environment.VITE_MQTT_DASHBOARD_PASSWORD;
  if (url === undefined && credentialEndpoint === undefined && username === undefined && password === undefined) return null;
  if (typeof url !== "string" || !url.startsWith("wss://")) throw new Error("VITE_MQTT_WSS_URL must use wss://.");
  if (username !== undefined || password !== undefined) {
    if (typeof username !== "string" || !username || typeof password !== "string" || !password) {
      throw new Error("Both MQTT dashboard credentials are required.");
    }
    if (credentialEndpoint !== undefined) throw new Error("Configure MQTT dashboard credentials or a credential endpoint, not both.");
    return { url, credentials: { username, password } };
  }
  if (typeof credentialEndpoint !== "string" || !credentialEndpoint.startsWith("https://")) {
    throw new Error("VITE_MQTT_CREDENTIAL_ENDPOINT must use https://.");
  }
  return { url, credentials: { credentialEndpoint } };
}

async function getCredentials(credentials: MqttCredentials | { credentialEndpoint: string }, pondId: string): Promise<MqttCredentials> {
  if ("username" in credentials) return credentials;

  const firebaseConfig = readFirebaseConfig(import.meta.env);
  const user = getFirebaseClient(firebaseConfig).auth.currentUser;
  if (!user) throw new Error("A Firebase user is required for MQTT.");

  const response = await fetch(credentials.credentialEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pondId }),
  });
  if (!response.ok) throw new Error("Could not obtain MQTT credentials.");
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.username !== "string" || typeof body.password !== "string" || !body.username || !body.password) {
    throw new Error("MQTT credential response is invalid.");
  }
  return { username: body.username, password: body.password };
}

export function parseMqttSensorMessage(payload: string, expectedPondId: string): MqttSensorSnapshot | null {
  try {
    const value: unknown = JSON.parse(payload);
    if (!isRecord(value) || value.version !== 1 || value.pondId !== expectedPondId ||
        typeof value.bootId !== "string" || value.bootId.length === 0 || !isSafeSequence(value.sequence) ||
        !isTimestamp(value.timestampMs) || !isRecord(value.sensors)) return null;
    const sensors = parseSensors(value.sensors);
    return sensors ? { pondId: expectedPondId, bootId: value.bootId, sequence: value.sequence, timestampMs: value.timestampMs, sensors } : null;
  } catch {
    return null;
  }
}

function parseSensors(value: Record<string, unknown>): PondSensors | null {
  if (!numberInRange(value.ph, 0, 14) || !numberInRange(value.do, 0, 30) || !numberInRange(value.temperature, 0, 60) ||
      !numberInRange(value.waterLevel, 0, 100) || typeof value.rain !== "boolean" || !numberInRange(value.ec, 0) ||
      !numberInRange(value.salinity, 0, 60)) return null;
  return { ph: value.ph, do: value.do, temperature: value.temperature, waterLevel: value.waterLevel, rain: value.rain, ec: value.ec, salinity: value.salinity };
}

function isNewerSnapshot(next: MqttSensorSnapshot, current: MqttSensorSnapshot | null): boolean {
  if (!current) return true;
  if (next.timestampMs !== current.timestampMs) return next.timestampMs > current.timestampMs;
  return next.bootId === current.bootId && next.sequence > current.sequence;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberInRange(value: unknown, minimum: number, maximum = Number.POSITIVE_INFINITY): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isSafeSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Date.now() + 60_000;
}

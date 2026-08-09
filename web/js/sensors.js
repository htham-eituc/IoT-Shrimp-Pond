import { db } from "./firebase.js";
import {
  get,
  limitToLast,
  onValue,
  push,
  query,
  ref,
  set,
  update,
} from "firebase/database";

export async function getUserProfile(uid) {
  const snapshot = await get(ref(db, `users/${uid}`));

  if (!snapshot.exists()) {
    throw new Error(`No database profile exists at /users/${uid}`);
  }

  const profile = snapshot.val();
  if (!profile.pondId) {
    throw new Error("The user profile does not contain a pondId");
  }

  return profile;
}

export function startSensorListener(pondId, onData, onError) {
  const sensorRef = ref(db, `ponds/${pondId}/sensors`);

  return onValue(
    sensorRef,
    (snapshot) => onData(snapshot.exists() ? snapshot.val() : null),
    onError,
  );
}

export function startDeviceListener(pondId, onData, onError) {
  const deviceRef = ref(db, `ponds/${pondId}/devices`);

  return onValue(
    deviceRef,
    (snapshot) => onData(snapshot.exists() ? snapshot.val() : null),
    onError,
  );
}

export function startModeListener(pondId, onData, onError) {
  const modeRef = ref(db, `settings/${pondId}/mode`);

  return onValue(
    modeRef,
    (snapshot) => onData(snapshot.exists() ? snapshot.val() : "automatic"),
    onError,
  );
}

export function startTelemetryListener(pondId, onData, onError) {
  const telemetryQuery = query(ref(db, `telemetry/${pondId}`), limitToLast(20));

  return onValue(
    telemetryQuery,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData([]);
        return;
      }

      const rows = Object.entries(snapshot.val())
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => Number(a.timestampMs ?? a.id) - Number(b.timestampMs ?? b.id));

      onData(rows);
    },
    onError,
  );
}

export function setPondMode(pondId, mode) {
  return set(ref(db, `settings/${pondId}/mode`), mode);
}

export function sendDeviceCommand(pondId, device, action) {
  const commandRef = push(ref(db, `commands/${pondId}`));

  return set(commandRef, {
    device,
    action,
    source: "manual",
    createdAtMs: Date.now(),
    status: "pending",
    processedAtMs: null,
  });
}

export function updateDeviceSnapshot(pondId, devices) {
  return update(ref(db, `ponds/${pondId}/devices`), devices);
}

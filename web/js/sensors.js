import { db } from "./firebase.js";
import { get, onValue, ref } from "firebase/database";

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

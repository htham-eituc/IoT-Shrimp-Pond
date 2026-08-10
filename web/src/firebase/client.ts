import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

const FIREBASE_APP_NAME = "smart-shrimp-pond-dashboard";

export interface FirebaseWebConfig extends FirebaseOptions {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  database: Database;
}

export function getFirebaseClient(config: FirebaseWebConfig): FirebaseClient {
  const app = getApps().some((candidate) => candidate.name === FIREBASE_APP_NAME)
    ? getApp(FIREBASE_APP_NAME)
    : initializeApp(config, FIREBASE_APP_NAME);

  return {
    app,
    auth: getAuth(app),
    database: getDatabase(app),
  };
}

export function readFirebaseConfig(
  environment: Record<string, string | boolean | undefined>,
): FirebaseWebConfig {
  return {
    apiKey: requireEnvironmentValue(environment, "VITE_FIREBASE_API_KEY"),
    authDomain: requireEnvironmentValue(environment, "VITE_FIREBASE_AUTH_DOMAIN"),
    databaseURL: requireEnvironmentValue(environment, "VITE_FIREBASE_DATABASE_URL"),
    projectId: requireEnvironmentValue(environment, "VITE_FIREBASE_PROJECT_ID"),
    storageBucket: requireEnvironmentValue(environment, "VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requireEnvironmentValue(environment, "VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: requireEnvironmentValue(environment, "VITE_FIREBASE_APP_ID"),
  };
}

function requireEnvironmentValue(
  environment: Record<string, string | boolean | undefined>,
  key: string,
): string {
  const value = environment[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} is required for Firebase Authentication.`);
  }
  return value.trim();
}

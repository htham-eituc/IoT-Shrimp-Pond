import { login, logout, observeAuthState } from "./auth.js";
import { getUserProfile, startSensorListener } from "./sensors.js";

const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");
const authStatus = document.getElementById("auth-status");
const profileOutput = document.getElementById("profile-output");
const sensorStatus = document.getElementById("sensor-status");
const sensorOutput = document.getElementById("sensor-output");

let stopSensorListener = null;

function describeError(error) {
  return error.code ? `${error.code}: ${error.message}` : error.message;
}

function resetSensorTest(message = "Sign in to start the sensor test.") {
  stopSensorListener?.();
  stopSensorListener = null;
  sensorStatus.textContent = message;
  sensorOutput.textContent = "No sensor data received.";
  profileOutput.textContent = "No profile loaded.";
}

async function testAuthenticatedReads(user) {
  try {
    authStatus.textContent = `Authenticated as ${user.email ?? user.uid}`;
    const profile = await getUserProfile(user.uid);

    profileOutput.textContent = JSON.stringify(
      { uid: user.uid, ...profile },
      null,
      2,
    );
    sensorStatus.textContent = `Listening to /ponds/${profile.pondId}/sensors ...`;

    stopSensorListener?.();
    stopSensorListener = startSensorListener(
      profile.pondId,
      (sensors) => {
        if (sensors === null) {
          sensorStatus.textContent = "Read succeeded, but no sensor data exists yet.";
          sensorOutput.textContent = "null";
          return;
        }

        sensorStatus.textContent = `Live data received at ${new Date().toLocaleTimeString()}`;
        sensorOutput.textContent = JSON.stringify(sensors, null, 2);
      },
      (error) => {
        sensorStatus.textContent = `Sensor read failed: ${describeError(error)}`;
      },
    );
  } catch (error) {
    sensorStatus.textContent = `Profile/database test failed: ${describeError(error)}`;
    profileOutput.textContent = "Profile could not be read.";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginButton.disabled = true;
  authStatus.textContent = "Authenticating...";

  try {
    await login(emailInput.value, passwordInput.value);
    passwordInput.value = "";
  } catch (error) {
    authStatus.textContent = `Authentication failed: ${describeError(error)}`;
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await logout();
  } catch (error) {
    authStatus.textContent = `Sign out failed: ${describeError(error)}`;
  }
});

observeAuthState((user) => {
  logoutButton.hidden = !user;

  if (user) {
    testAuthenticatedReads(user);
  } else {
    authStatus.textContent = "Not authenticated.";
    resetSensorTest();
  }
});

import { login, logout, observeAuthState } from "./auth.js";
import {
  getUserProfile,
  sendDeviceCommand,
  setPondMode,
  startDeviceListener,
  startModeListener,
  startSensorListener,
  startTelemetryListener,
} from "./sensors.js";

const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");
const authStatus = document.getElementById("auth-status");
const profileOutput = document.getElementById("profile-output");
const sensorStatus = document.getElementById("sensor-status");
const sensorOutput = document.getElementById("sensor-output");
const modeSelect = document.getElementById("mode-select");
const modeStatus = document.getElementById("mode-status");
const deviceControls = document.getElementById("device-controls");
const deviceOutput = document.getElementById("device-output");
const telemetryStatus = document.getElementById("telemetry-status");
const telemetryCanvas = document.getElementById("telemetry-chart");

let stopSensorListener = null;
let stopDeviceListener = null;
let stopModeListener = null;
let stopTelemetryListener = null;
let activeProfile = null;

const controllableDevices = [
  ["aerator", "Aerator"],
  ["drainagePump", "Drainage pump"],
  ["dilutionPump", "Dilution pump"],
  ["feeder", "Feeder"],
  ["buzzer", "Buzzer"],
  ["warningBeacon", "Warning beacon"],
];

function describeError(error) {
  return error.code ? `${error.code}: ${error.message}` : error.message;
}

function resetSensorTest(message = "Sign in to start the sensor test.") {
  stopSensorListener?.();
  stopDeviceListener?.();
  stopModeListener?.();
  stopTelemetryListener?.();
  stopSensorListener = null;
  stopDeviceListener = null;
  stopModeListener = null;
  stopTelemetryListener = null;
  activeProfile = null;
  sensorStatus.textContent = message;
  sensorOutput.textContent = "No sensor data received.";
  profileOutput.textContent = "No profile loaded.";
  modeStatus.textContent = "No mode loaded.";
  modeSelect.value = "automatic";
  modeSelect.disabled = true;
  deviceControls.replaceChildren();
  deviceOutput.textContent = "No device state received.";
  telemetryStatus.textContent = "No telemetry loaded.";
  clearChart();
}

function clearChart() {
  const context = telemetryCanvas.getContext("2d");
  context.clearRect(0, 0, telemetryCanvas.width, telemetryCanvas.height);
}

function drawTelemetryChart(rows) {
  const context = telemetryCanvas.getContext("2d");
  const width = telemetryCanvas.width;
  const height = telemetryCanvas.height;
  const padding = 34;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#111827";
  context.fillRect(0, 0, width, height);

  if (rows.length < 2) {
    context.fillStyle = "#d1d5db";
    context.fillText("Waiting for telemetry...", padding, height / 2);
    return;
  }

  const plot = (key, color, minValue, maxValue) => {
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = 2;

    rows.forEach((row, index) => {
      const x = padding + ((width - padding * 2) * index) / (rows.length - 1);
      const normalized = (Number(row[key]) - minValue) / (maxValue - minValue);
      const y = height - padding - Math.max(0, Math.min(1, normalized)) * (height - padding * 2);

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    context.stroke();
  };

  context.strokeStyle = "#374151";
  context.strokeRect(padding, padding, width - padding * 2, height - padding * 2);
  plot("do", "#60a5fa", 0, 10);
  plot("temperature", "#f59e0b", 20, 40);
  plot("ph", "#34d399", 6, 10);

  context.fillStyle = "#d1d5db";
  context.fillText("DO", padding, 18);
  context.fillStyle = "#f59e0b";
  context.fillText("Temp", padding + 34, 18);
  context.fillStyle = "#34d399";
  context.fillText("pH", padding + 82, 18);
}

function renderDeviceControls(devices = {}) {
  deviceControls.replaceChildren();

  for (const [device, label] of controllableDevices) {
    const row = document.createElement("div");
    row.className = "control-row";

    const name = document.createElement("span");
    name.textContent = `${label}: ${devices[device] ? "on" : "off"}`;

    const onButton = document.createElement("button");
    onButton.type = "button";
    onButton.textContent = "On";
    onButton.disabled = !activeProfile;
    onButton.addEventListener("click", () => sendManualCommand(device, "on"));

    const offButton = document.createElement("button");
    offButton.type = "button";
    offButton.textContent = "Off";
    offButton.disabled = !activeProfile;
    offButton.addEventListener("click", () => sendManualCommand(device, "off"));

    row.append(name, onButton, offButton);
    deviceControls.append(row);
  }
}

async function sendManualCommand(device, action) {
  if (!activeProfile) {
    return;
  }

  modeStatus.textContent = `Sending ${device} ${action} command...`;

  try {
    await sendDeviceCommand(activeProfile.pondId, device, action);
    modeStatus.textContent = `Command queued: ${device} ${action}`;
  } catch (error) {
    modeStatus.textContent = `Command failed: ${describeError(error)}`;
  }
}

async function testAuthenticatedReads(user) {
  try {
    authStatus.textContent = `Authenticated as ${user.email ?? user.uid}`;
    const profile = await getUserProfile(user.uid);
    activeProfile = profile;

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

    stopDeviceListener?.();
    stopDeviceListener = startDeviceListener(
      profile.pondId,
      (devices) => {
        deviceOutput.textContent = JSON.stringify(devices, null, 2);
        renderDeviceControls(devices ?? {});
      },
      (error) => {
        deviceOutput.textContent = `Device read failed: ${describeError(error)}`;
      },
    );

    stopModeListener?.();
    stopModeListener = startModeListener(
      profile.pondId,
      (mode) => {
        modeSelect.disabled = false;
        modeSelect.value = mode;
        modeStatus.textContent = `Current mode: ${mode}`;
      },
      (error) => {
        modeStatus.textContent = `Mode read failed: ${describeError(error)}`;
      },
    );

    stopTelemetryListener?.();
    stopTelemetryListener = startTelemetryListener(
      profile.pondId,
      (rows) => {
        telemetryStatus.textContent = `${rows.length} recent telemetry points loaded.`;
        drawTelemetryChart(rows);
      },
      (error) => {
        telemetryStatus.textContent = `Telemetry read failed: ${describeError(error)}`;
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

modeSelect.addEventListener("change", async () => {
  if (!activeProfile) {
    return;
  }

  modeSelect.disabled = true;
  modeStatus.textContent = `Switching to ${modeSelect.value} mode...`;

  try {
    await setPondMode(activeProfile.pondId, modeSelect.value);
  } catch (error) {
    modeStatus.textContent = `Mode update failed: ${describeError(error)}`;
  } finally {
    modeSelect.disabled = false;
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

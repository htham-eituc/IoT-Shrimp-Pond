#include <Arduino.h>

#include "src/alerts.h"
#include "src/automation.h"
#include "src/commands.h"
#include "src/config.h"
#include "src/firebase_client.h"
#include "src/hardware.h"
#include "src/sensors.h"
#include "src/types.h"

unsigned long lastUploadMs = 0;
unsigned long lastCommandCheckMs = 0;
unsigned long lastSettingsRefreshMs = 0;
unsigned long lastSimulationRefreshMs = 0;

String currentMode = "automatic";
DeviceState currentDevices = {false, false, false, false, false, false};
SimulationControl simulation = {false, "normal", "initial"};

void setup() {
  Serial.begin(115200);
  setupPins();
  connectWiFi();
  setupFirebase();
}

void loop() {
  if (!firebaseReady()) {
    delay(500);
    return;
  }

  const unsigned long now = millis();

  if (lastSettingsRefreshMs == 0 || now - lastSettingsRefreshMs >= SETTINGS_REFRESH_INTERVAL_MS) {
    lastSettingsRefreshMs = now;
    const String previousMode = currentMode;
    refreshMode(currentMode);
    if (previousMode != "manual" && currentMode == "manual") {
      stopSimulationOverride(simulation, "manual_mode");
    }
  }

  if (currentMode == "automatic" && (lastSimulationRefreshMs == 0 || now - lastSimulationRefreshMs >= SIMULATION_REFRESH_INTERVAL_MS)) {
    lastSimulationRefreshMs = now;
    refreshSimulationControl(simulation);
  } else if (currentMode == "manual") {
    stopSimulationOverride(simulation, "manual_mode");
  }

  if (lastCommandCheckMs == 0 || now - lastCommandCheckMs >= COMMAND_CHECK_INTERVAL_MS) {
    lastCommandCheckMs = now;
    processPendingCommands(currentMode, currentDevices);
  }

  if (now - lastUploadMs < SENSOR_UPLOAD_INTERVAL_MS) {
    return;
  }
  if (!systemTimeReady()) {
    Serial.println("Waiting for NTP time before uploading timestamped data...");
    delay(500);
    return;
  }
  lastUploadMs = now;

  SensorReadings sensors = readSensors(simulation, currentDevices);
  String status = statusFor(sensors);

  if (currentMode == "automatic") {
    DeviceState nextDevices = automaticDevicesFor(sensors, status);
    const uint64_t timestampMs = currentTimestampMs();
    writeAutomaticDeviceChangeEvents(currentDevices, nextDevices, timestampMs);
    currentDevices = nextDevices;
    applyOutputs(currentDevices);
  }

  uploadState(sensors, currentDevices, status, currentMode);
}

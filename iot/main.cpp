#include <Arduino.h>

#include "src/alerts.h"
#include "src/automation.h"
#include "src/commands.h"
#include "src/config.h"
#include "src/display.h"
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
PondSettings currentSettings = {
  {{7.2f, 8.8f}, {5.0f, 4.5f, 3.5f, 5.5f}, {0.0f, 33.0f}, {0.0f, 30.0f}, {0.0f, 80.0f}},
  {true, true, true},
};

void setup() {
  Serial.begin(115200);
  setupPins();
  setupDisplays();
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
    refreshPondSettings(currentMode, currentSettings);
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

  SensorReadings sensors = readSensors(simulation);
  String status = statusFor(sensors, currentSettings);
  applyStatusIndicators(status);

  if (currentMode == "automatic") {
    DeviceState nextDevices = automaticDevicesFor(sensors, status, currentSettings);
    const uint64_t timestampMs = currentTimestampMs();
    writeAutomaticDeviceChangeEvents(currentDevices, nextDevices, timestampMs);
    currentDevices = nextDevices;
    applyOutputs(currentDevices);
  }

  uploadState(sensors, currentDevices, status, currentMode, currentSettings);
  updateDisplays(sensors, currentDevices, status, currentMode, simulation);
}

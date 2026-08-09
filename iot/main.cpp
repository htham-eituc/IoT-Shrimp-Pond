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

String currentMode = "automatic";
DeviceState currentDevices = {false, false, false, false, false, false};

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
    refreshMode(currentMode);
  }

  if (lastCommandCheckMs == 0 || now - lastCommandCheckMs >= COMMAND_CHECK_INTERVAL_MS) {
    lastCommandCheckMs = now;
    processPendingCommands(currentMode, currentDevices);
  }

  if (now - lastUploadMs < SENSOR_UPLOAD_INTERVAL_MS) {
    return;
  }
  lastUploadMs = now;

  SensorReadings sensors = readSensors();
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

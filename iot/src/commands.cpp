#include "commands.h"

#include <Firebase_ESP_Client.h>

#include "alerts.h"
#include "firebase_client.h"
#include "hardware.h"

namespace {

bool getCommandString(FirebaseJson &commandJson, const char *key, String &value) {
  FirebaseJsonData data;

  if (!commandJson.get(data, key) || !data.success) {
    return false;
  }

  value = data.to<String>();
  return true;
}

}

void refreshMode(String &currentMode) {
  const String path = settingsPath("mode");

  if (!Firebase.RTDB.getString(&fbdo, path)) {
    Serial.printf("Read failed: %s -> %s\n", path.c_str(), fbdo.errorReason().c_str());
    return;
  }

  const String mode = fbdo.stringData();
  if (mode == "automatic" || mode == "manual") {
    currentMode = mode;
  }
}

namespace {

void setDeviceByName(DeviceState &devices, const String &device, bool isOn) {
  if (device == "aerator") {
    devices.aerator = isOn;
  } else if (device == "drainagePump") {
    devices.drainagePump = isOn;
  } else if (device == "dilutionPump") {
    devices.dilutionPump = isOn;
  } else if (device == "feeder") {
    devices.feeder = isOn;
  } else if (device == "buzzer") {
    devices.buzzer = isOn;
  } else if (device == "warningBeacon") {
    devices.warningBeacon = isOn;
  }
}

void addDevicesJson(FirebaseJson &json, const DeviceState &devices) {
  json.set("aerator", devices.aerator);
  json.set("drainagePump", devices.drainagePump);
  json.set("dilutionPump", devices.dilutionPump);
  json.set("feeder", devices.feeder);
  json.set("buzzer", devices.buzzer);
  json.set("warningBeacon", devices.warningBeacon);
}

void markCommandProcessed(const String &commandId, const String &status) {
  const uint64_t timestampMs = currentTimestampMs();
  const String statusPath = commandChildPath(commandId, "status");
  const String processedAtPath = commandChildPath(commandId, "processedAtMs");

  if (!Firebase.RTDB.setString(&fbdo, statusPath, status)) {
    Serial.printf("Write failed: %s -> %s\n", statusPath.c_str(), fbdo.errorReason().c_str());
  }

  if (!Firebase.RTDB.setDouble(&fbdo, processedAtPath, static_cast<double>(timestampMs))) {
    Serial.printf("Write failed: %s -> %s\n", processedAtPath.c_str(), fbdo.errorReason().c_str());
  }
}

}

void processPendingCommands(const String &currentMode, DeviceState &currentDevices) {
  if (currentMode != "manual") {
    return;
  }

  const String path = commandsPath();
  if (!Firebase.RTDB.getJSON(&fbdo, path)) {
    Serial.printf("Read failed: %s -> %s\n", path.c_str(), fbdo.errorReason().c_str());
    return;
  }

  FirebaseJson *commandsJson = fbdo.jsonObjectPtr();
  const size_t commandCount = commandsJson->iteratorBegin();
  PendingCommand pendingCommands[10];
  size_t pendingCount = 0;

  for (size_t i = 0; i < commandCount; i++) {
    int type = 0;
    String commandId;
    String commandValue;
    commandsJson->iteratorGet(i, type, commandId, commandValue);

    FirebaseJson commandJson;
    commandJson.setJsonData(commandValue);

    String status;
    String device;
    String action;

    if (!getCommandString(commandJson, "status", status) || status != "pending") {
      continue;
    }

    if (!getCommandString(commandJson, "device", device) || !getCommandString(commandJson, "action", action)) {
      continue;
    }

    if (action != "on" && action != "off") {
      continue;
    }

    if (pendingCount >= 10) {
      break;
    }

    pendingCommands[pendingCount] = {commandId, device, action};
    pendingCount++;
  }

  commandsJson->iteratorEnd();

  for (size_t i = 0; i < pendingCount; i++) {
    const PendingCommand &command = pendingCommands[i];
    const bool isOn = command.action == "on";

    setDeviceByName(currentDevices, command.device, isOn);
    applyOutputs(currentDevices);

    FirebaseJson devicesJson;
    addDevicesJson(devicesJson, currentDevices);

    const String devicesPath = pondPath("devices");
    if (!Firebase.RTDB.setJSON(&fbdo, devicesPath, &devicesJson)) {
      Serial.printf("Write failed: %s -> %s\n", devicesPath.c_str(), fbdo.errorReason().c_str());
      markCommandProcessed(command.id, "failed");
      continue;
    }

    markCommandProcessed(command.id, "completed");
    writeEvent("manual", command.device, command.action, "firebase_command", currentTimestampMs());
    Serial.printf("Manual command completed: %s %s\n", command.device.c_str(), command.action.c_str());
  }
}

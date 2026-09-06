#include "commands.h"

#include <math.h>

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

bool getSettingNumber(FirebaseJson &json, const char *path, float &value) {
  FirebaseJsonData data;
  if (!json.get(data, path) || !data.success) return false;
  value = data.to<float>();
  return isfinite(value);
}

bool getSettingNumberOrDefault(FirebaseJson &json, const char *path, float &value, float fallback) {
  FirebaseJsonData data;
  if (!json.get(data, path) || !data.success) {
    value = fallback;
    return true;
  }
  value = data.to<float>();
  return isfinite(value);
}

bool getSettingBool(FirebaseJson &json, const char *path, bool &value) {
  FirebaseJsonData data;
  if (!json.get(data, path) || !data.success) return false;
  value = data.to<bool>();
  return true;
}

bool getRangeThreshold(FirebaseJson &json, const char *path, RangeThreshold &threshold, float criticalHighFallback) {
  return getSettingNumber(json, (String(path) + "/warningLow").c_str(), threshold.warningLow) &&
         getSettingNumber(json, (String(path) + "/warningHigh").c_str(), threshold.warningHigh) &&
         getSettingNumberOrDefault(json, (String(path) + "/criticalHigh").c_str(), threshold.criticalHigh, criticalHighFallback) &&
         threshold.warningLow <= threshold.warningHigh && threshold.warningHigh <= threshold.criticalHigh;
}

bool getPhThreshold(FirebaseJson &json, PhThreshold &threshold) {
  return getSettingNumber(json, "thresholds/ph/warningLow", threshold.warningLow) &&
         getSettingNumber(json, "thresholds/ph/warningHigh", threshold.warningHigh) &&
         getSettingNumberOrDefault(json, "thresholds/ph/criticalLow", threshold.criticalLow, 6.8f) &&
         getSettingNumberOrDefault(json, "thresholds/ph/criticalHigh", threshold.criticalHigh, 9.0f) &&
         threshold.criticalLow <= threshold.warningLow && threshold.warningHigh <= threshold.criticalHigh;
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

bool refreshPondSettings(String &currentMode, PondSettings &settings) {
  const String path = settingsPath("");
  if (!Firebase.RTDB.getJSON(&fbdo, path)) {
    Serial.printf("Read failed: %s -> %s\n", path.c_str(), fbdo.errorReason().c_str());
    return false;
  }

  FirebaseJson *json = fbdo.jsonObjectPtr();
  PondSettings next = settings;
  String mode;
  if (!getCommandString(*json, "mode", mode) || (mode != "automatic" && mode != "manual") ||
      !getPhThreshold(*json, next.thresholds.ph) ||
      !getSettingNumber(*json, "thresholds/do/normalMin", next.thresholds.dissolvedOxygen.normalMin) ||
      !getSettingNumber(*json, "thresholds/do/hypoxia", next.thresholds.dissolvedOxygen.hypoxia) ||
      !getSettingNumber(*json, "thresholds/do/critical", next.thresholds.dissolvedOxygen.critical) ||
      !getSettingNumber(*json, "thresholds/do/recovery", next.thresholds.dissolvedOxygen.recovery) ||
      !getRangeThreshold(*json, "thresholds/temperature", next.thresholds.temperature, 35.0f) ||
      !getRangeThreshold(*json, "thresholds/salinity", next.thresholds.salinity, 35.0f) ||
      !getRangeThreshold(*json, "thresholds/waterLevel", next.thresholds.waterLevel, 90.0f) ||
      !getSettingBool(*json, "automation/hypoxiaResponseEnabled", next.automation.hypoxiaResponseEnabled) ||
      !getSettingBool(*json, "automation/rainOverflowResponseEnabled", next.automation.rainOverflowResponseEnabled) ||
      !getSettingBool(*json, "automation/heatSalinityResponseEnabled", next.automation.heatSalinityResponseEnabled) ||
      next.thresholds.dissolvedOxygen.critical > next.thresholds.dissolvedOxygen.hypoxia ||
      next.thresholds.dissolvedOxygen.hypoxia > next.thresholds.dissolvedOxygen.normalMin ||
      next.thresholds.dissolvedOxygen.normalMin > next.thresholds.dissolvedOxygen.recovery) {
    Serial.println("Ignoring invalid pond settings payload.");
    return false;
  }

  currentMode = mode;
  settings = next;
  return true;
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

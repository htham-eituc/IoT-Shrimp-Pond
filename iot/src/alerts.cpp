#include "alerts.h"

#include <Firebase_ESP_Client.h>

#include "firebase_client.h"

namespace {

String lastAlertKey = "";

void addSensorsJson(FirebaseJson &json, const SensorReadings &sensors) {
  json.set("ph", sensors.ph);
  json.set("do", sensors.dissolvedOxygen);
  json.set("temperature", sensors.temperature);
  json.set("waterLevel", sensors.waterLevel);
  json.set("rain", sensors.rain);
  json.set("ec", sensors.ec);
  json.set("salinity", sensors.salinity);
}

void addDevicesJson(FirebaseJson &json, const DeviceState &devices) {
  json.set("aerator", devices.aerator);
  json.set("drainagePump", devices.drainagePump);
  json.set("dilutionPump", devices.dilutionPump);
  json.set("feeder", devices.feeder);
  json.set("buzzer", devices.buzzer);
  json.set("warningBeacon", devices.warningBeacon);
}

String actionFor(bool isOn) {
  return isOn ? "on" : "off";
}

String activeAlertKeyFor(const SensorReadings &sensors, const String &status) {
  if (status == "normal") {
    return "";
  }

  if (sensors.dissolvedOxygen < 3.5f) {
    return "critical-do";
  }
  if (sensors.dissolvedOxygen < 4.5f) {
    return "warning-do";
  }
  if (sensors.waterLevel > 90) {
    return "critical-water-level";
  }
  if (sensors.rain && sensors.waterLevel > 80) {
    return "warning-rain-overflow";
  }
  if (sensors.temperature > 33.0f) {
    return "warning-temperature";
  }
  if (sensors.ph < 6.8f || sensors.ph > 9.0f) {
    return "critical-ph";
  }
  if (sensors.ph < 7.2f || sensors.ph > 8.8f) {
    return "warning-ph";
  }

  return "warning-general";
}

String alertMessageFor(const String &alertKey) {
  if (alertKey == "critical-do") {
    return "Dissolved oxygen is critically low.";
  }
  if (alertKey == "warning-do") {
    return "Dissolved oxygen is below the safe range.";
  }
  if (alertKey == "critical-water-level") {
    return "Water level is critically high.";
  }
  if (alertKey == "warning-rain-overflow") {
    return "Rain and high water level may cause overflow.";
  }
  if (alertKey == "warning-temperature") {
    return "Water temperature is above the safe range.";
  }
  if (alertKey == "critical-ph") {
    return "pH is critically outside the safe range.";
  }
  if (alertKey == "warning-ph") {
    return "pH is outside the preferred range.";
  }

  return "Pond conditions need attention.";
}

}

void writeEvent(const String &source, const String &device, const String &action, const String &reason, uint64_t timestampMs) {
  FirebaseJson eventJson;
  eventJson.set("type", "device_action");
  eventJson.set("source", source);
  eventJson.set("device", device);
  eventJson.set("action", action);
  eventJson.set("reason", reason);
  eventJson.set("createdAtMs", static_cast<double>(timestampMs));

  const String path = eventPath(timestampMs, device);
  if (!Firebase.RTDB.setJSON(&fbdo, path, &eventJson)) {
    Serial.printf("Write failed: %s -> %s\n", path.c_str(), fbdo.errorReason().c_str());
  }
}

void writeDeviceChangeEventIfNeeded(const String &device, bool previousState, bool nextState, const String &reason, uint64_t timestampMs) {
  if (previousState == nextState) {
    return;
  }

  writeEvent("automatic", device, actionFor(nextState), reason, timestampMs);
}

void writeAutomaticDeviceChangeEvents(const DeviceState &previousDevices, const DeviceState &nextDevices, uint64_t timestampMs) {
  writeDeviceChangeEventIfNeeded("aerator", previousDevices.aerator, nextDevices.aerator, "dissolved_oxygen_threshold", timestampMs);
  writeDeviceChangeEventIfNeeded("drainagePump", previousDevices.drainagePump, nextDevices.drainagePump, "rain_or_water_level_threshold", timestampMs);
  writeDeviceChangeEventIfNeeded("dilutionPump", previousDevices.dilutionPump, nextDevices.dilutionPump, "temperature_or_salinity_threshold", timestampMs);
  writeDeviceChangeEventIfNeeded("feeder", previousDevices.feeder, nextDevices.feeder, "automatic_feeding_schedule", timestampMs);
  writeDeviceChangeEventIfNeeded("buzzer", previousDevices.buzzer, nextDevices.buzzer, "critical_status", timestampMs);
  writeDeviceChangeEventIfNeeded("warningBeacon", previousDevices.warningBeacon, nextDevices.warningBeacon, "warning_or_critical_status", timestampMs);
}

void writeAlertIfChanged(const SensorReadings &sensors, const String &status, uint64_t timestampMs) {
  const String alertKey = activeAlertKeyFor(sensors, status);

  if (alertKey == lastAlertKey) {
    return;
  }

  lastAlertKey = alertKey;

  if (alertKey == "") {
    return;
  }

  FirebaseJson alertJson;
  alertJson.set("type", alertKey);
  alertJson.set("severity", status);
  alertJson.set("status", "active");
  alertJson.set("message", alertMessageFor(alertKey));
  alertJson.set("measurements/ph", sensors.ph);
  alertJson.set("measurements/do", sensors.dissolvedOxygen);
  alertJson.set("measurements/temperature", sensors.temperature);
  alertJson.set("measurements/waterLevel", sensors.waterLevel);
  alertJson.set("measurements/rain", sensors.rain);
  alertJson.set("measurements/ec", sensors.ec);
  alertJson.set("measurements/salinity", sensors.salinity);
  alertJson.set("createdAtMs", static_cast<double>(timestampMs));

  const String path = alertPath(timestampMs);
  if (!Firebase.RTDB.setJSON(&fbdo, path, &alertJson)) {
    Serial.printf("Write failed: %s -> %s\n", path.c_str(), fbdo.errorReason().c_str());
  }
}

void uploadState(const SensorReadings &sensors, const DeviceState &devices, const String &status, const String &mode) {
  const uint64_t timestampMs = currentTimestampMs();

  FirebaseJson sensorsJson;
  addSensorsJson(sensorsJson, sensors);

  FirebaseJson devicesJson;
  addDevicesJson(devicesJson, devices);

  FirebaseJson telemetryJson;
  telemetryJson.set("timestampMs", static_cast<double>(timestampMs));
  addSensorsJson(telemetryJson, sensors);

  const String sensorsPath = pondPath("sensors");
  const String devicesPath = pondPath("devices");
  const String statusPath = pondPath("status");
  const String connectedPath = pondPath("connected");
  const String lastSeenPath = pondPath("lastSeenMs");
  const String historyPath = telemetryPath(timestampMs);

  bool ok = true;

  if (!Firebase.RTDB.setJSON(&fbdo, sensorsPath, &sensorsJson)) {
    Serial.printf("Write failed: %s -> %s\n", sensorsPath.c_str(), fbdo.errorReason().c_str());
    ok = false;
  }

  if (!Firebase.RTDB.setJSON(&fbdo, devicesPath, &devicesJson)) {
    Serial.printf("Write failed: %s -> %s\n", devicesPath.c_str(), fbdo.errorReason().c_str());
    ok = false;
  }

  if (!Firebase.RTDB.setString(&fbdo, statusPath, status)) {
    Serial.printf("Write failed: %s -> %s\n", statusPath.c_str(), fbdo.errorReason().c_str());
    ok = false;
  }

  if (!Firebase.RTDB.setBool(&fbdo, connectedPath, true)) {
    Serial.printf("Write failed: %s -> %s\n", connectedPath.c_str(), fbdo.errorReason().c_str());
    ok = false;
  }

  if (!Firebase.RTDB.setDouble(&fbdo, lastSeenPath, static_cast<double>(timestampMs))) {
    Serial.printf("Write failed: %s -> %s\n", lastSeenPath.c_str(), fbdo.errorReason().c_str());
    ok = false;
  }

  if (!Firebase.RTDB.setJSON(&fbdo, historyPath, &telemetryJson)) {
    Serial.printf("Write failed: %s -> %s\n", historyPath.c_str(), fbdo.errorReason().c_str());
    ok = false;
  }

  writeAlertIfChanged(sensors, status, timestampMs);

  Serial.printf(
      "Firebase upload %s | mode=%s status=%s ph=%.1f do=%.1f temp=%.1f level=%d rain=%s\n",
      ok ? "ok" : "failed",
      mode.c_str(),
      status.c_str(),
      sensors.ph,
      sensors.dissolvedOxygen,
      sensors.temperature,
      sensors.waterLevel,
      sensors.rain ? "true" : "false");
}

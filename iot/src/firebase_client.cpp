#include "firebase_client.h"

#include <WiFi.h>
#include <time.h>

#if __has_include("../secrets.h")
#include "../secrets.h"
#else
#include "../secrets.example.h"
#endif

#include "addons/RTDBHelper.h"
#include "addons/TokenHelper.h"
#include "config.h"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

bool firebaseReady() {
  return Firebase.ready();
}

String pondPath(const char *childPath) {
  return "/ponds/" + String(POND_ID) + "/" + childPath;
}

String settingsPath(const char *childPath) {
  return "/settings/" + String(POND_ID) + "/" + childPath;
}

String commandsPath() {
  return "/commands/" + String(POND_ID);
}

String commandChildPath(const String &commandId, const char *childPath) {
  return commandsPath() + "/" + commandId + "/" + childPath;
}

String timestampString(uint64_t timestampMs) {
  char buffer[24];
  snprintf(buffer, sizeof(buffer), "%llu", static_cast<unsigned long long>(timestampMs));
  return String(buffer);
}

String alertPath(uint64_t timestampMs) {
  return "/alerts/" + String(POND_ID) + "/alert-" + timestampString(timestampMs);
}

String eventPath(uint64_t timestampMs, const String &suffix) {
  return "/events/" + String(POND_ID) + "/event-" + timestampString(timestampMs) + "-" + suffix;
}

String telemetryPath(uint64_t timestampMs) {
  const uint16_t slot = static_cast<uint16_t>(
      (timestampMs / SENSOR_UPLOAD_INTERVAL_MS) % TELEMETRY_RETENTION_RECORDS);
  char slotKey[16];
  snprintf(slotKey, sizeof(slotKey), "slot-%03u", slot);
  return "/telemetry/" + String(POND_ID) + "/" + String(slotKey);
}

namespace {

String simulationControlPath() {
  return "/simulation/" + String(POND_ID) + "/control";
}

String simulationStatePath() {
  return "/simulation/" + String(POND_ID) + "/state";
}

bool getJsonString(FirebaseJson &json, const char *path, String &value) {
  FirebaseJsonData data;
  if (!json.get(data, path) || !data.success) return false;
  value = data.to<String>();
  return true;
}

bool getJsonBool(FirebaseJson &json, const char *path, bool &value) {
  FirebaseJsonData data;
  if (!json.get(data, path) || !data.success) return false;
  value = data.to<bool>();
  return true;
}

String normalizeSimulationScenario(const String &scenario) {
  return scenario == "rain" ? "rain_overflow" : scenario;
}

bool isSimulationScenario(const String &scenario) {
  const String normalized = normalizeSimulationScenario(scenario);
  return normalized == "normal" || normalized == "rain_overflow" || normalized == "hypoxia" || normalized == "heat_salinity";
}

void writeSimulationState(const SimulationControl &control) {
  const uint64_t timestampMs = currentTimestampMs();
  FirebaseJson state;
  state.set("active", control.enabled);
  state.set("scenario", control.enabled ? normalizeSimulationScenario(control.scenario) : "normal");
  state.set("requestId", control.requestId);
  state.set("startedAtMs", static_cast<double>(timestampMs));
  state.set("updatedAtMs", static_cast<double>(timestampMs));

  const String path = simulationStatePath();
  if (!Firebase.RTDB.setJSON(&fbdo, path, &state)) {
    Serial.printf("Write failed: %s -> %s\n", path.c_str(), fbdo.errorReason().c_str());
  }
}

}

uint64_t currentTimestampMs() {
  const time_t nowSeconds = time(nullptr);

  if (nowSeconds > 1700000000) {
    return static_cast<uint64_t>(nowSeconds) * 1000ULL;
  }

  return static_cast<uint64_t>(millis());
}

bool systemTimeReady() {
  return time(nullptr) > 1700000000;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.printf("Connecting to WiFi SSID %s", WIFI_SSID);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.printf("\nWiFi connected, IP: %s\n", WiFi.localIP().toString().c_str());
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
}

void setupFirebase() {
  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;

  auth.user.email = DEVICE_EMAIL;
  auth.user.password = DEVICE_PASSWORD;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("Signing in to Firebase as device account...");
}

bool refreshSimulationControl(SimulationControl &control) {
  const String path = simulationControlPath();
  if (!Firebase.RTDB.getJSON(&fbdo, path)) {
    Serial.printf("Read failed: %s -> %s\n", path.c_str(), fbdo.errorReason().c_str());
    return false;
  }

  FirebaseJson *json = fbdo.jsonObjectPtr();
  SimulationControl next;
  if (!getJsonBool(*json, "enabled", next.enabled) ||
      !getJsonString(*json, "scenario", next.scenario) ||
      !getJsonString(*json, "requestId", next.requestId) ||
      !isSimulationScenario(next.scenario)) {
    Serial.println("Ignoring invalid simulation control payload.");
    return false;
  }

  if (!next.enabled) next.scenario = "normal";
  next.scenario = normalizeSimulationScenario(next.scenario);

  const bool changed = next.enabled != control.enabled ||
                       next.scenario != control.scenario ||
                       next.requestId != control.requestId;
  control = next;
  if (changed) {
    writeSimulationState(control);
    Serial.printf("Simulation %s: %s\n", control.enabled ? "started" : "stopped", control.scenario.c_str());
  }
  return true;
}

void stopSimulationOverride(SimulationControl &control, const char *reason) {
  if (!control.enabled && control.scenario == "normal") return;

  control.enabled = false;
  control.scenario = "normal";
  writeSimulationState(control);
  Serial.printf("Simulation stopped: %s\n", reason);
}

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
  return "/telemetry/" + String(POND_ID) + "/" + timestampString(timestampMs);
}

uint64_t currentTimestampMs() {
  const time_t nowSeconds = time(nullptr);

  if (nowSeconds > 1700000000) {
    return static_cast<uint64_t>(nowSeconds) * 1000ULL;
  }

  return static_cast<uint64_t>(millis());
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

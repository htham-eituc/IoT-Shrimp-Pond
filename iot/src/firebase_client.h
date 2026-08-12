#pragma once

#include <Arduino.h>
#include <Firebase_ESP_Client.h>

extern FirebaseData fbdo;

bool firebaseReady();
void connectWiFi();
void setupFirebase();

String pondPath(const char *childPath);
String settingsPath(const char *childPath);
String commandsPath();
String commandChildPath(const String &commandId, const char *childPath);
String timestampString(uint64_t timestampMs);
String alertPath(uint64_t timestampMs);
String eventPath(uint64_t timestampMs, const String &suffix);
String telemetryPath(uint64_t timestampMs);
uint64_t currentTimestampMs();

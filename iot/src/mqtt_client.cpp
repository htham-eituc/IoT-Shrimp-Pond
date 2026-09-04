#include "mqtt_client.h"

#if __has_include("../secrets.h")
#include "../secrets.h"
#else
#include "../secrets.example.h"
#endif

#if __has_include("../mqtt_ca.h")
#include "../mqtt_ca.h"
#define MQTT_TLS_CA_CONFIGURED 1
#endif

#if defined(MQTT_BROKER_HOST)

#include <esp_system.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>

#ifndef MQTT_BROKER_PORT
#define MQTT_BROKER_PORT 8883
#endif

namespace {

constexpr unsigned long MQTT_RECONNECT_INTERVAL_MS = 5000;
WiFiClientSecure mqttTransport;
PubSubClient mqttClient(mqttTransport);
unsigned long lastMqttConnectAttemptMs = 0;
uint32_t mqttSequence = 0;
String mqttBootId;

String mqttTopic() {
  return "shrimp-pond/v1/ponds/" + String(POND_ID) + "/sensors";
}

String mqttClientId() {
#if defined(MQTT_DEVICE_ID)
  return String(MQTT_DEVICE_ID) + "-" + mqttBootId;
#else
  return String(POND_ID) + "-" + mqttBootId;
#endif
}

bool connectMqtt() {
#if !defined(MQTT_TLS_CA_CONFIGURED) || !defined(MQTT_DEVICE_USERNAME) || !defined(MQTT_DEVICE_PASSWORD)
  Serial.println("MQTT disabled: TLS CA or device credentials are not configured.");
  return false;
#else
  mqttTransport.setCACert(MQTT_TLS_ROOT_CA);
  const String clientId = mqttClientId();
  const bool connected = mqttClient.connect(clientId.c_str(), MQTT_DEVICE_USERNAME, MQTT_DEVICE_PASSWORD);
  if (!connected) {
    Serial.printf("MQTT connect failed, state=%d\n", mqttClient.state());
  } else {
    Serial.println("MQTT connected.");
  }
  return connected;
#endif
}

}  // namespace

void setupMqtt() {
  mqttBootId = String(static_cast<uint32_t>(esp_random()), HEX);
  mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
  mqttClient.setBufferSize(512);
}

void mqttLoop() {
  if (mqttClient.connected()) {
    mqttClient.loop();
    return;
  }

  const unsigned long now = millis();
  if (now - lastMqttConnectAttemptMs < MQTT_RECONNECT_INTERVAL_MS) return;
  lastMqttConnectAttemptMs = now;
  connectMqtt();
}

bool publishSensorSnapshot(const SensorReadings &sensors, uint64_t timestampMs) {
  if (!mqttClient.connected()) return false;

  const uint32_t sequence = ++mqttSequence;
  char payload[512];
  const int written = snprintf(
      payload, sizeof(payload),
      "{\"version\":1,\"pondId\":\"%s\",\"deviceId\":\"%s\",\"bootId\":\"%s\",\"sequence\":%lu,\"timestampMs\":%llu,\"sensors\":{\"ph\":%.1f,\"do\":%.1f,\"temperature\":%.1f,\"waterLevel\":%d,\"rain\":%s,\"ec\":%.1f,\"salinity\":%.1f}}",
      POND_ID,
#if defined(MQTT_DEVICE_ID)
      MQTT_DEVICE_ID,
#else
      POND_ID,
#endif
      mqttBootId.c_str(), static_cast<unsigned long>(sequence), static_cast<unsigned long long>(timestampMs),
      sensors.ph, sensors.dissolvedOxygen, sensors.temperature, sensors.waterLevel, sensors.rain ? "true" : "false",
      sensors.ec, sensors.salinity);

  if (written < 0 || static_cast<size_t>(written) >= sizeof(payload)) {
    Serial.println("MQTT sensor payload is too large.");
    return false;
  }

  const String topic = mqttTopic();
  const bool published = mqttClient.publish(topic.c_str(), reinterpret_cast<const uint8_t *>(payload), written, true);
  if (!published) Serial.printf("MQTT publish failed, state=%d\n", mqttClient.state());
  return published;
}

#else

void setupMqtt() {}
void mqttLoop() {}
bool publishSensorSnapshot(const SensorReadings &, uint64_t) { return false; }

#endif

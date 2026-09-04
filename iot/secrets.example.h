#pragma once

#define WIFI_SSID "Wokwi-GUEST"
#define WIFI_PASSWORD ""

#define FIREBASE_API_KEY "YOUR_FIREBASE_WEB_API_KEY"
#define FIREBASE_DATABASE_URL "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com/"

#define DEVICE_EMAIL "device@example.com"
#define DEVICE_PASSWORD "device-password"

#define POND_ID "pond-001"

// Optional MQTT sensor publishing. Leave MQTT_BROKER_HOST undefined to disable
// MQTT without changing the Firebase/Wokwi flow. The browser connects over WSS;
// the ESP32 normally connects to the broker's TLS MQTT port.
//
// #define MQTT_BROKER_HOST "mqtt.example.com"
// #define MQTT_BROKER_PORT 8883
// #define MQTT_DEVICE_ID "pond-controller-001"
// #define MQTT_DEVICE_USERNAME "device-credential"
// #define MQTT_DEVICE_PASSWORD "device-secret"
//
// Put the broker CA certificate in the ignored iot/mqtt_ca.h file. See
// mqtt_ca.example.h; a multiline raw string cannot be used in a #define.

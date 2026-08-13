#include "hardware.h"

#include <Arduino.h>

#include "config.h"

void setupPins() {
  pinMode(RAIN_PIN, INPUT_PULLUP);
  pinMode(AERATOR_LED_PIN, OUTPUT);
  pinMode(DRAINAGE_LED_PIN, OUTPUT);
  pinMode(DILUTION_LED_PIN, OUTPUT);
  pinMode(FEEDER_LED_PIN, OUTPUT);
  pinMode(BUZZER_LED_PIN, OUTPUT);
  pinMode(WARNING_LED_PIN, OUTPUT);
  pinMode(STATUS_NORMAL_LED_PIN, OUTPUT);
  pinMode(STATUS_WARNING_LED_PIN, OUTPUT);
  pinMode(STATUS_CRITICAL_LED_PIN, OUTPUT);
}

void applyOutputs(const DeviceState &devices) {
  digitalWrite(AERATOR_LED_PIN, devices.aerator);
  digitalWrite(DRAINAGE_LED_PIN, devices.drainagePump);
  digitalWrite(DILUTION_LED_PIN, devices.dilutionPump);
  digitalWrite(FEEDER_LED_PIN, devices.feeder);
  digitalWrite(BUZZER_LED_PIN, devices.buzzer);
  digitalWrite(WARNING_LED_PIN, devices.warningBeacon);
}

void applyStatusIndicators(const String &status) {
  digitalWrite(STATUS_NORMAL_LED_PIN, status == "normal");
  digitalWrite(STATUS_WARNING_LED_PIN, status == "warning");
  digitalWrite(STATUS_CRITICAL_LED_PIN, status == "critical");
}

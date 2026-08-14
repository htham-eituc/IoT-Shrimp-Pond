#pragma once

#include <Arduino.h>

constexpr int PH_PIN = 34;
constexpr int DO_PIN = 35;
constexpr int SALINITY_PIN = 36;
constexpr int TEMP_PIN = 32;
constexpr int WATER_LEVEL_PIN = 33;
constexpr int EC_PIN = 36;
constexpr int RAIN_PIN = 25;

constexpr int AERATOR_LED_PIN = 16;
constexpr int DRAINAGE_LED_PIN = 17;
constexpr int DILUTION_LED_PIN = 18;
constexpr int FEEDER_LED_PIN = 19;
constexpr int BUZZER_LED_PIN = 21;
constexpr int WARNING_LED_PIN = 22;

constexpr int STATUS_NORMAL_LED_PIN = 13;
constexpr int STATUS_WARNING_LED_PIN = 14;
constexpr int STATUS_CRITICAL_LED_PIN = 15;

constexpr int LCD_SDA_PIN = 26;
constexpr int LCD_SCL_PIN = 27;
constexpr int SENSOR_LCD_ADDRESS = 0x27;
constexpr int STATUS_LCD_ADDRESS = 0x3F;

constexpr unsigned long SENSOR_UPLOAD_INTERVAL_MS = 5000;
constexpr uint16_t TELEMETRY_RETENTION_RECORDS = 100;
constexpr unsigned long COMMAND_CHECK_INTERVAL_MS = 2000;
constexpr unsigned long SETTINGS_REFRESH_INTERVAL_MS = 10000;
constexpr unsigned long SIMULATION_REFRESH_INTERVAL_MS = 2000;
constexpr unsigned long LCD_REFRESH_INTERVAL_MS = 1000;

// Fraction of the remaining distance moved toward a simulation target on each
// sensor upload. Use a smaller value for a slower transition or a larger value
// for a faster transition. Valid range: 0.01f to 1.0f.
constexpr float SIMULATION_ALPHA = 0.75f;

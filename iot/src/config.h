#pragma once

#include <Arduino.h>

constexpr int PH_PIN = 34;
constexpr int DO_PIN = 35;
constexpr int TEMP_PIN = 32;
constexpr int WATER_LEVEL_PIN = 33;
constexpr int RAIN_PIN = 25;

constexpr int AERATOR_LED_PIN = 16;
constexpr int DRAINAGE_LED_PIN = 17;
constexpr int DILUTION_LED_PIN = 18;
constexpr int FEEDER_LED_PIN = 19;
constexpr int BUZZER_LED_PIN = 21;
constexpr int WARNING_LED_PIN = 22;

constexpr unsigned long SENSOR_UPLOAD_INTERVAL_MS = 5000;
constexpr unsigned long COMMAND_CHECK_INTERVAL_MS = 2000;
constexpr unsigned long SETTINGS_REFRESH_INTERVAL_MS = 10000;
constexpr unsigned long SIMULATION_REFRESH_INTERVAL_MS = 2000;

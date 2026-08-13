#include "sensors.h"

#include <Arduino.h>

#include "config.h"

float mapAdcToFloat(int pin, float minValue, float maxValue);
float roundToOneDecimal(float value);

namespace {

struct SimulationRuntime {
  bool initialized = false;
  String requestId = "";
  unsigned long lastStepMs = 0;
  SensorReadings readings = {};
};

SimulationRuntime runtime;

float approach(float current, float target, float maximumChange) {
  if (current < target) return min(current + maximumChange, target);
  if (current > target) return max(current - maximumChange, target);
  return current;
}

SensorReadings physicalReadings() {
  SensorReadings sensors;
  sensors.ph = roundToOneDecimal(mapAdcToFloat(PH_PIN, 6.5f, 9.2f));
  sensors.dissolvedOxygen = roundToOneDecimal(mapAdcToFloat(DO_PIN, 2.5f, 8.0f));
  sensors.temperature = roundToOneDecimal(mapAdcToFloat(TEMP_PIN, 24.0f, 36.0f));
  sensors.waterLevel = static_cast<int>(roundf(mapAdcToFloat(WATER_LEVEL_PIN, 0.0f, 100.0f)));
  sensors.rain = digitalRead(RAIN_PIN) == LOW;
  sensors.ec = roundToOneDecimal(mapAdcToFloat(EC_PIN, 5.0f, 35.0f));
  sensors.salinity = roundToOneDecimal(sensors.ec * 1.09f);
  return sensors;
}

SensorReadings targetFor(const String &scenario) {
  if (scenario == "rain_overflow" || scenario == "rain") {
    return {6.5f, 4.2f, 26.0f, 98, true, 12.0f, 13.1f};
  }
  if (scenario == "hypoxia") {
    return {7.4f, 2.6f, 29.0f, 72, false, 19.0f, 20.7f};
  }
  if (scenario == "heat_salinity") {
    return {7.6f, 4.6f, 36.5f, 68, false, 36.7f, 40.0f};
  }
  return runtime.readings;
}

void applyDeviceEffects(const DeviceState &devices, float elapsedSec) {
  // Actuator effects oppose the scenario pressure without cancelling it. This
  // makes the change in slope visible while allowing critical states to occur.
  if (devices.aerator) {
    runtime.readings.dissolvedOxygen = approach(
        runtime.readings.dissolvedOxygen, 6.5f, 0.045f * elapsedSec);
  }
  if (devices.drainagePump) {
    runtime.readings.waterLevel = static_cast<int>(roundf(approach(
        static_cast<float>(runtime.readings.waterLevel), 55.0f, 0.8f * elapsedSec)));
  }
  if (devices.dilutionPump) {
    runtime.readings.temperature = approach(runtime.readings.temperature, 29.0f, 0.07f * elapsedSec);
    runtime.readings.ec = approach(runtime.readings.ec, 18.0f, 0.20f * elapsedSec);
    runtime.readings.salinity = approach(runtime.readings.salinity, 20.0f, 0.22f * elapsedSec);
  }
  if (devices.feeder) {
    runtime.readings.dissolvedOxygen = approach(
        runtime.readings.dissolvedOxygen, 2.5f, 0.015f * elapsedSec);
  }
}

void advanceSimulation(const SensorReadings &target, const DeviceState &devices, float elapsedSec) {
  // Rates are deliberately slow enough to cross actuator thresholds over
  // several upload cycles, making the controller response observable.
  runtime.readings.ph = approach(runtime.readings.ph, target.ph, 0.025f * elapsedSec);
  runtime.readings.dissolvedOxygen = approach(
      runtime.readings.dissolvedOxygen, target.dissolvedOxygen, 0.07f * elapsedSec);
  runtime.readings.temperature = approach(
      runtime.readings.temperature, target.temperature, 0.13f * elapsedSec);
  runtime.readings.waterLevel = static_cast<int>(roundf(approach(
      static_cast<float>(runtime.readings.waterLevel), static_cast<float>(target.waterLevel), 1.2f * elapsedSec)));
  runtime.readings.ec = approach(runtime.readings.ec, target.ec, 0.38f * elapsedSec);
  runtime.readings.salinity = approach(runtime.readings.salinity, target.salinity, 0.42f * elapsedSec);
  runtime.readings.rain = target.rain;

  applyDeviceEffects(devices, elapsedSec);

  runtime.readings.ph = roundToOneDecimal(runtime.readings.ph);
  runtime.readings.dissolvedOxygen = roundToOneDecimal(runtime.readings.dissolvedOxygen);
  runtime.readings.temperature = roundToOneDecimal(runtime.readings.temperature);
  runtime.readings.ec = roundToOneDecimal(runtime.readings.ec);
  runtime.readings.salinity = roundToOneDecimal(runtime.readings.salinity);
}

}

float mapAdcToFloat(int pin, float minValue, float maxValue) {
  const int raw = analogRead(pin);
  return minValue + ((maxValue - minValue) * raw / 4095.0f);
}

float roundToOneDecimal(float value) {
  return roundf(value * 10.0f) / 10.0f;
}

SensorReadings readSensors(const SimulationControl &simulation, const DeviceState &devices) {
  const SensorReadings physical = physicalReadings();
  if (!simulation.enabled) {
    runtime.initialized = false;
    return physical;
  }

  const unsigned long nowMs = millis();
  if (!runtime.initialized || runtime.requestId != simulation.requestId) {
    runtime.initialized = true;
    runtime.requestId = simulation.requestId;
    runtime.lastStepMs = nowMs;
    runtime.readings = physical;
    Serial.printf("Simulation ramp started from current readings: %s\n", simulation.scenario.c_str());
    return runtime.readings;
  }

  const float elapsedSec = min(static_cast<float>(nowMs - runtime.lastStepMs) / 1000.0f, 10.0f);
  runtime.lastStepMs = nowMs;
  advanceSimulation(targetFor(simulation.scenario), devices, elapsedSec);
  return runtime.readings;
}

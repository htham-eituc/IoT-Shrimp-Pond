#include "sensors.h"

#include <Arduino.h>

#include "config.h"

float mapAdcToFloat(int pin, float minValue, float maxValue) {
  const int raw = analogRead(pin);
  return minValue + ((maxValue - minValue) * raw / 4095.0f);
}

float roundToOneDecimal(float value) {
  return roundf(value * 10.0f) / 10.0f;
}

namespace {

struct SimulationReadings {
  float ph;
  float dissolvedOxygen;
  float temperature;
  float waterLevel;
  float ec;
  float salinity;
  bool rain;
};

SimulationReadings simulatedSensors;
bool simulationInitialized = false;

float simulationAlpha() {
  return constrain(SIMULATION_ALPHA, 0.01f, 1.0f);
}

float approach(float current, float target, float alpha) {
  const float next = current + alpha * (target - current);
  return fabsf(target - next) < 0.01f ? target : next;
}

SimulationReadings fromSensorReadings(const SensorReadings &sensors) {
  return {
    sensors.ph,
    sensors.dissolvedOxygen,
    sensors.temperature,
    static_cast<float>(sensors.waterLevel),
    sensors.ec,
    sensors.salinity,
    sensors.rain,
  };
}

SensorReadings toSensorReadings(const SimulationReadings &sensors) {
  return {
    roundToOneDecimal(sensors.ph),
    roundToOneDecimal(sensors.dissolvedOxygen),
    roundToOneDecimal(sensors.temperature),
    static_cast<int>(roundf(sensors.waterLevel)),
    sensors.rain,
    roundToOneDecimal(sensors.ec),
    roundToOneDecimal(sensors.salinity),
  };
}

SimulationReadings targetFor(const String &scenario, const SimulationReadings &fallback) {
  if (scenario == "rain_overflow" || scenario == "rain") {
    return {6.4f, 5.2f, 25.0f, 98.0f, 10.2f, 12.0f, true};
  }
  if (scenario == "hypoxia") {
    return {7.5f, 2.8f, 28.0f, 72.0f, 17.1f, 20.0f, false};
  }
  if (scenario == "heat_salinity") {
    return {7.6f, 4.6f, 36.5f, 68.0f, 32.4f, 38.0f, false};
  }
  return fallback;
}

void approachTarget(SimulationReadings &current, const SimulationReadings &target) {
  const float alpha = simulationAlpha();
  current.ph = approach(current.ph, target.ph, alpha);
  current.dissolvedOxygen = approach(current.dissolvedOxygen, target.dissolvedOxygen, alpha);
  current.temperature = approach(current.temperature, target.temperature, alpha);
  current.waterLevel = approach(current.waterLevel, target.waterLevel, alpha);
  current.ec = approach(current.ec, target.ec, alpha);
  current.salinity = approach(current.salinity, target.salinity, alpha);
  current.rain = target.rain;
}

}  // namespace

SensorReadings readSensors(const SimulationControl &simulation) {
  SensorReadings sensors;
  sensors.ph = roundToOneDecimal(mapAdcToFloat(PH_PIN, 6.5f, 9.2f));
  sensors.dissolvedOxygen = roundToOneDecimal(mapAdcToFloat(DO_PIN, 2.5f, 8.0f));
  sensors.temperature = roundToOneDecimal(mapAdcToFloat(TEMP_PIN, 24.0f, 36.0f));
  sensors.waterLevel = static_cast<int>(roundf(mapAdcToFloat(WATER_LEVEL_PIN, 0.0f, 100.0f)));
  sensors.rain = digitalRead(RAIN_PIN) == LOW;

  sensors.salinity = roundToOneDecimal(mapAdcToFloat(SALINITY_PIN, 5.0f, 35.0f));
  sensors.ec = roundToOneDecimal(10.0f + sensors.salinity * 0.85f);

  if (!simulation.enabled) {
    simulationInitialized = false;
    return sensors;
  }

  if (!simulationInitialized) {
    // Begin from the actual potentiometer/sensor state, not from a preset.
    simulatedSensors = fromSensorReadings(sensors);
    simulationInitialized = true;
  }

  const SimulationReadings target = targetFor(simulation.scenario, simulatedSensors);
  approachTarget(simulatedSensors, target);
  return toSensorReadings(simulatedSensors);
}

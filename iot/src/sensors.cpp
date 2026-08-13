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

SensorReadings readSensors(const SimulationControl &simulation) {
  SensorReadings sensors;
  sensors.ph = roundToOneDecimal(mapAdcToFloat(PH_PIN, 6.5f, 9.2f));
  sensors.dissolvedOxygen = roundToOneDecimal(mapAdcToFloat(DO_PIN, 2.5f, 8.0f));
  sensors.temperature = roundToOneDecimal(mapAdcToFloat(TEMP_PIN, 24.0f, 36.0f));
  sensors.waterLevel = static_cast<int>(roundf(mapAdcToFloat(WATER_LEVEL_PIN, 0.0f, 100.0f)));
  sensors.rain = digitalRead(RAIN_PIN) == LOW;

  sensors.salinity = roundToOneDecimal(mapAdcToFloat(SALINITY_PIN, 5.0f, 35.0f));
  sensors.ec = roundToOneDecimal(10.0f + sensors.salinity * 0.85f);

  if (!simulation.enabled) return sensors;

  if (simulation.scenario == "rain_overflow" || simulation.scenario == "rain") {
    sensors = {5.6f, 6.0f, 26.0f, 96, true, 11.9f, 13.0f};
  } else if (simulation.scenario == "hypoxia") {
    sensors = {7.5f, 3.6f, 27.0f, 80, false, 17.3f, 19.0f};
  } else if (simulation.scenario == "heat_salinity") {
    sensors = {7.6f, 5.0f, 34.5f, 74, false, 29.2f, 32.0f};
  }

  return sensors;
}

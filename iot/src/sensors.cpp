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

SensorReadings readSensors() {
  SensorReadings sensors;
  sensors.ph = roundToOneDecimal(mapAdcToFloat(PH_PIN, 6.5f, 9.2f));
  sensors.dissolvedOxygen = roundToOneDecimal(mapAdcToFloat(DO_PIN, 2.5f, 8.0f));
  sensors.temperature = roundToOneDecimal(mapAdcToFloat(TEMP_PIN, 24.0f, 36.0f));
  sensors.waterLevel = static_cast<int>(roundf(mapAdcToFloat(WATER_LEVEL_PIN, 0.0f, 100.0f)));
  sensors.rain = digitalRead(RAIN_PIN) == LOW;

  // EC and salinity are derived so Firebase receives the complete schema expected by the web/rules.
  sensors.salinity = roundToOneDecimal(mapAdcToFloat(DO_PIN, 5.0f, 35.0f));
  sensors.ec = roundToOneDecimal(10.0f + sensors.salinity * 0.85f);

  return sensors;
}

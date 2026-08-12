#include "automation.h"

String statusFor(const SensorReadings &sensors) {
  if (sensors.dissolvedOxygen < 3.5f || sensors.waterLevel > 90 || sensors.ph < 6.8f || sensors.ph > 9.0f) {
    return "critical";
  }

  if (sensors.dissolvedOxygen < 4.5f || sensors.waterLevel > 80 || sensors.rain ||
      sensors.temperature > 33.0f || sensors.ph < 7.2f || sensors.ph > 8.8f) {
    return "warning";
  }

  return "normal";
}

DeviceState automaticDevicesFor(const SensorReadings &sensors, const String &status) {
  DeviceState devices;
  devices.aerator = sensors.dissolvedOxygen < 5.0f;
  devices.drainagePump = sensors.rain && sensors.waterLevel > 80;
  devices.dilutionPump = sensors.temperature > 33.0f || sensors.salinity > 30.0f;
  devices.feeder = false;
  devices.buzzer = status == "critical";
  devices.warningBeacon = status != "normal";
  return devices;
}

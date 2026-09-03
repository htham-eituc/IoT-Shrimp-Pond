#include "automation.h"

String statusFor(const SensorReadings &sensors, const PondSettings &settings) {
  const ThresholdSettings &thresholds = settings.thresholds;

  if (sensors.dissolvedOxygen < thresholds.dissolvedOxygen.critical) {
    return "critical";
  }

  if (sensors.dissolvedOxygen < thresholds.dissolvedOxygen.hypoxia ||
      sensors.waterLevel > thresholds.waterLevel.warningHigh || sensors.rain ||
      sensors.temperature < thresholds.temperature.warningLow || sensors.temperature > thresholds.temperature.warningHigh ||
      sensors.salinity < thresholds.salinity.warningLow || sensors.salinity > thresholds.salinity.warningHigh ||
      sensors.ph < thresholds.ph.warningLow || sensors.ph > thresholds.ph.warningHigh) {
    return "warning";
  }

  return "normal";
}

DeviceState automaticDevicesFor(const SensorReadings &sensors, const String &status, const PondSettings &settings) {
  DeviceState devices;
  const ThresholdSettings &thresholds = settings.thresholds;
  devices.aerator = settings.automation.hypoxiaResponseEnabled &&
                    sensors.dissolvedOxygen < thresholds.dissolvedOxygen.normalMin;
  devices.drainagePump = settings.automation.rainOverflowResponseEnabled && sensors.rain &&
                         sensors.waterLevel > thresholds.waterLevel.warningHigh;
  devices.dilutionPump = settings.automation.heatSalinityResponseEnabled &&
                         (sensors.temperature > thresholds.temperature.warningHigh ||
                          sensors.salinity > thresholds.salinity.warningHigh);
  devices.feeder = false;
  devices.buzzer = status == "critical";
  devices.warningBeacon = status != "normal";
  return devices;
}

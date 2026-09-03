#pragma once

#include <Arduino.h>

struct SensorReadings {
  float ph;
  float dissolvedOxygen;
  float temperature;
  int waterLevel;
  bool rain;
  float ec;
  float salinity;
};

struct DeviceState {
  bool aerator;
  bool drainagePump;
  bool dilutionPump;
  bool feeder;
  bool buzzer;
  bool warningBeacon;
};

struct PendingCommand {
  String id;
  String device;
  String action;
};

struct SimulationControl {
  bool enabled;
  String scenario;
  String requestId;
};

struct RangeThreshold {
  float warningLow;
  float warningHigh;
};

struct DissolvedOxygenThreshold {
  float normalMin;
  float hypoxia;
  float critical;
  float recovery;
};

struct ThresholdSettings {
  RangeThreshold ph;
  DissolvedOxygenThreshold dissolvedOxygen;
  RangeThreshold temperature;
  RangeThreshold salinity;
  RangeThreshold waterLevel;
};

struct AutomationSettings {
  bool hypoxiaResponseEnabled;
  bool rainOverflowResponseEnabled;
  bool heatSalinityResponseEnabled;
};

struct PondSettings {
  ThresholdSettings thresholds;
  AutomationSettings automation;
};

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

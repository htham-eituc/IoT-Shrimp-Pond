#pragma once

#include <Arduino.h>

#include "types.h"

void setupDisplays();
void updateDisplays(
  const SensorReadings &sensors,
  const DeviceState &devices,
  const String &status,
  const String &mode,
  const SimulationControl &simulation);

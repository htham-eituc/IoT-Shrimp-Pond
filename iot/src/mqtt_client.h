#pragma once

#include <Arduino.h>

#include "types.h"

void setupMqtt();
void mqttLoop();
bool publishSensorSnapshot(const SensorReadings &sensors, uint64_t timestampMs);

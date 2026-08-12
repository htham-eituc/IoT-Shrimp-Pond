#pragma once

#include <Arduino.h>

#include "types.h"

void writeEvent(const String &source, const String &device, const String &action, const String &reason, uint64_t timestampMs);
void writeAutomaticDeviceChangeEvents(const DeviceState &previousDevices, const DeviceState &nextDevices, uint64_t timestampMs);
void uploadState(const SensorReadings &sensors, const DeviceState &devices, const String &status, const String &mode);

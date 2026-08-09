#pragma once

#include <Arduino.h>

#include "types.h"

String statusFor(const SensorReadings &sensors);
DeviceState automaticDevicesFor(const SensorReadings &sensors, const String &status);

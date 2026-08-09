#pragma once

#include <Arduino.h>

#include "types.h"

void refreshMode(String &currentMode);
void processPendingCommands(const String &currentMode, DeviceState &currentDevices);

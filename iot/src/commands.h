#pragma once

#include <Arduino.h>

#include "types.h"

void refreshMode(String &currentMode);
bool refreshPondSettings(String &currentMode, PondSettings &settings);
void processPendingCommands(const String &currentMode, DeviceState &currentDevices);

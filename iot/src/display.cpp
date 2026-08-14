#include "display.h"

#include <LiquidCrystal_I2C.h>
#include <Wire.h>

#include "config.h"

namespace {

LiquidCrystal_I2C sensorLcd(SENSOR_LCD_ADDRESS, 16, 2);
LiquidCrystal_I2C statusLcd(STATUS_LCD_ADDRESS, 16, 2);

unsigned long lastDisplayMs = 0;
bool sensorPage = false;

void printPadded(LiquidCrystal_I2C &lcd, const String &text) {
  lcd.print(text.substring(0, 16));
  for (int i = text.length(); i < 16; i++) {
    lcd.print(' ');
  }
}

String statusLabel(const String &status) {
  if (status == "critical") return "CRIT";
  if (status == "warning") return "WARN";
  return "OK";
}

String modeLabel(const String &mode) {
  return mode == "manual" ? "MAN" : "AUTO";
}

String outputGroup(const DeviceState &devices, bool safetyPage) {
  String outputs;
  if (!safetyPage) {
    if (devices.aerator) outputs += "AER ";
    if (devices.drainagePump) outputs += "DRN ";
    if (devices.dilutionPump) outputs += "DIL ";
    if (devices.feeder) outputs += "FED ";
  } else {
    if (devices.buzzer) outputs += "BUZ ";
    if (devices.warningBeacon) outputs += "BCN ";
  }

  outputs.trim();
  return outputs;
}

String activeOutputs(const DeviceState &devices, bool safetyPage) {
  String outputs = outputGroup(devices, safetyPage);
  if (outputs.length() > 0) return outputs;

  if (outputGroup(devices, !safetyPage).length() > 0) {
    return safetyPage ? "Safety none" : "Main none";
  }

  return "Outputs none";
}

bool anyOutputActive(const DeviceState &devices) {
  return devices.aerator ||
         devices.drainagePump ||
         devices.dilutionPump ||
         devices.feeder ||
         devices.buzzer ||
         devices.warningBeacon;
}

String activeOutputsSummary(const DeviceState &devices) {
  String outputs;
  if (devices.aerator) outputs += "AER ";
  if (devices.drainagePump) outputs += "DRN ";
  if (devices.dilutionPump) outputs += "DIL ";
  if (devices.feeder) outputs += "FED ";
  if (devices.buzzer) outputs += "BUZ ";
  if (devices.warningBeacon) outputs += "BCN ";
  outputs.trim();
  return outputs.length() == 0 ? "Outputs none" : outputs;
}

void drawSensorLcd(const SensorReadings &sensors) {
  sensorLcd.setCursor(0, 0);
  if (sensorPage) {
    printPadded(sensorLcd, "EC " + String(sensors.ec, 1) + " Sal " + String(sensors.salinity, 1));
    sensorLcd.setCursor(0, 1);
    printPadded(sensorLcd, String("Rain ") + (sensors.rain ? "YES" : "NO") + " L" + String(sensors.waterLevel) + "%");
    return;
  }

  printPadded(sensorLcd, "pH " + String(sensors.ph, 1) + " DO " + String(sensors.dissolvedOxygen, 1));
  sensorLcd.setCursor(0, 1);
  printPadded(sensorLcd, "T " + String(sensors.temperature, 1) + "C L " + String(sensors.waterLevel) + "%");
}

void drawStatusLcd(
  const DeviceState &devices,
  const String &status,
  const String &mode,
  const SimulationControl &simulation) {
  statusLcd.setCursor(0, 0);
  String line = statusLabel(status) + " " + modeLabel(mode);
  if (simulation.enabled) line += " SIM";
  printPadded(statusLcd, line);

  statusLcd.setCursor(0, 1);
  if (!anyOutputActive(devices)) {
    printPadded(statusLcd, "Outputs none");
  } else if (activeOutputsSummary(devices).length() <= 16) {
    printPadded(statusLcd, activeOutputsSummary(devices));
  } else {
    printPadded(statusLcd, activeOutputs(devices, sensorPage));
  }
}

}

void setupDisplays() {
  Wire.begin(LCD_SDA_PIN, LCD_SCL_PIN);

  sensorLcd.init();
  sensorLcd.backlight();
  statusLcd.init();
  statusLcd.backlight();

  sensorLcd.setCursor(0, 0);
  printPadded(sensorLcd, "Shrimp sensors");
  sensorLcd.setCursor(0, 1);
  printPadded(sensorLcd, "Waiting data");

  statusLcd.setCursor(0, 0);
  printPadded(statusLcd, "Pond status");
  statusLcd.setCursor(0, 1);
  printPadded(statusLcd, "Outputs none");
}

void updateDisplays(
  const SensorReadings &sensors,
  const DeviceState &devices,
  const String &status,
  const String &mode,
  const SimulationControl &simulation) {
  const unsigned long now = millis();
  if (lastDisplayMs != 0 && now - lastDisplayMs < LCD_REFRESH_INTERVAL_MS) return;

  sensorPage = !sensorPage;
  lastDisplayMs = now;
  drawSensorLcd(sensors);
  drawStatusLcd(devices, status, mode, simulation);
}

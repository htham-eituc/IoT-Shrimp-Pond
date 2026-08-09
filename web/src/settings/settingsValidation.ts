import type { PondSettings, RangeThresholdSettings } from "../domain";

export type SettingsValidationErrors = Record<string, string>;

export function validatePondSettings(settings: PondSettings): SettingsValidationErrors {
  const errors: SettingsValidationErrors = {};

  validateRange(errors, "thresholds.ph", settings.thresholds.ph, 0, 14);
  validateRange(errors, "thresholds.temperature", settings.thresholds.temperature, 0, 60);
  validateRange(errors, "thresholds.salinity", settings.thresholds.salinity, 0, 60);
  validateRange(errors, "thresholds.waterLevel", settings.thresholds.waterLevel, 0, 100);

  const dissolvedOxygen = settings.thresholds.do;
  for (const field of ["normalMin", "hypoxia", "critical", "recovery"] as const) {
    validateNumber(errors, `thresholds.do.${field}`, dissolvedOxygen[field], 0, 30);
  }
  validateNumber(errors, "thresholds.do.triggerDurationSec", dissolvedOxygen.triggerDurationSec, 0);

  if (dissolvedOxygen.critical > dissolvedOxygen.hypoxia) {
    errors["thresholds.do.critical"] = "Critical must be less than or equal to hypoxia.";
  }
  if (dissolvedOxygen.hypoxia > dissolvedOxygen.normalMin) {
    errors["thresholds.do.hypoxia"] = "Hypoxia must be less than or equal to normalMin.";
  }
  if (dissolvedOxygen.normalMin > dissolvedOxygen.recovery) {
    errors["thresholds.do.recovery"] = "Recovery must be greater than or equal to normalMin.";
  }

  if (settings.mode !== "automatic" && settings.mode !== "manual") {
    errors.mode = "Mode must be automatic or manual.";
  }

  for (const [field, value] of Object.entries(settings.automation)) {
    if (typeof value !== "boolean") {
      errors[`automation.${field}`] = "Automation flags must be boolean values.";
    }
  }

  validateNumber(
    errors,
    "thresholds.waterLevel.overflowTriggerDurationSec",
    settings.thresholds.waterLevel.overflowTriggerDurationSec,
    0,
  );

  return errors;
}

function validateRange(
  errors: SettingsValidationErrors,
  path: string,
  settings: RangeThresholdSettings,
  minimum: number,
  maximum: number,
): void {
  for (const field of ["normalMin", "normalMax", "warningLow", "warningHigh"] as const) {
    validateNumber(errors, `${path}.${field}`, settings[field], minimum, maximum);
  }

  if (settings.warningLow > settings.normalMin) {
    errors[`${path}.warningLow`] = "warningLow must be less than or equal to normalMin.";
  }
  if (settings.normalMin > settings.normalMax) {
    errors[`${path}.normalMax`] = "normalMax must be greater than or equal to normalMin.";
  }
  if (settings.normalMax > settings.warningHigh) {
    errors[`${path}.warningHigh`] = "warningHigh must be greater than or equal to normalMax.";
  }
}

function validateNumber(
  errors: SettingsValidationErrors,
  path: string,
  value: number,
  minimum: number,
  maximum?: number,
): void {
  if (!Number.isFinite(value)) {
    errors[path] = "Enter a finite number.";
    return;
  }
  if (value < minimum) {
    errors[path] = `Value must be at least ${minimum}.`;
  }
  if (maximum !== undefined && value > maximum) {
    errors[path] = `Value must be at most ${maximum}.`;
  }
}

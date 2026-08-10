import type { PondSettings, RangeThresholdSettings } from "../domain";

export type SettingsValidationErrorCode =
  | "criticalOrder"
  | "hypoxiaOrder"
  | "recoveryOrder"
  | "mode"
  | "automationBoolean"
  | "warningLowOrder"
  | "normalRangeOrder"
  | "warningHighOrder"
  | "finiteNumber"
  | "minimum"
  | "maximum";

export interface SettingsValidationError {
  code: SettingsValidationErrorCode;
  values?: { minimum?: number; maximum?: number };
}

export type SettingsValidationErrors = Record<string, SettingsValidationError>;

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
    errors["thresholds.do.critical"] = { code: "criticalOrder" };
  }
  if (dissolvedOxygen.hypoxia > dissolvedOxygen.normalMin) {
    errors["thresholds.do.hypoxia"] = { code: "hypoxiaOrder" };
  }
  if (dissolvedOxygen.normalMin > dissolvedOxygen.recovery) {
    errors["thresholds.do.recovery"] = { code: "recoveryOrder" };
  }

  if (settings.mode !== "automatic" && settings.mode !== "manual") {
    errors.mode = { code: "mode" };
  }

  for (const [field, value] of Object.entries(settings.automation)) {
    if (typeof value !== "boolean") {
      errors[`automation.${field}`] = { code: "automationBoolean" };
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
    errors[`${path}.warningLow`] = { code: "warningLowOrder" };
  }
  if (settings.normalMin > settings.normalMax) {
    errors[`${path}.normalMax`] = { code: "normalRangeOrder" };
  }
  if (settings.normalMax > settings.warningHigh) {
    errors[`${path}.warningHigh`] = { code: "warningHighOrder" };
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
    errors[path] = { code: "finiteNumber" };
    return;
  }
  if (value < minimum) {
    errors[path] = { code: "minimum", values: { minimum } };
  }
  if (maximum !== undefined && value > maximum) {
    errors[path] = { code: "maximum", values: { maximum } };
  }
}

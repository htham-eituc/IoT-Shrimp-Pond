import { useState, type FormEvent } from "react";
import { CloudRain, Moon, RotateCcw, Save, Settings2, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { OperatingMode, PondSettings } from "../domain";
import type { PondDataSource } from "../data";
import { translateError } from "../i18n";
import { validatePondSettings, type SettingsValidationError, type SettingsValidationErrors } from "../settings/settingsValidation";
import { ConfirmationDialog } from "./ConfirmationDialog";
import type { Theme } from "../theme";

interface NumberFieldDefinition {
  key: string;
  unit?: string;
  step?: number;
  minimum: number;
  maximum?: number;
}

interface ThresholdGroupDefinition {
  key: keyof PondSettings["thresholds"];
  fields: NumberFieldDefinition[];
}

const THRESHOLD_GROUPS: ThresholdGroupDefinition[] = [
  {
    key: "ph",
    fields: rangeFields("", 0, 14, 0.1),
  },
  {
    key: "do",
    fields: [
      field("normalMin", "mg/L", 0, 30, 0.1),
      field("hypoxia", "mg/L", 0, 30, 0.1),
      field("critical", "mg/L", 0, 30, 0.1),
      field("recovery", "mg/L", 0, 30, 0.1),
      field("triggerDurationSec", "seconds", 0, undefined, 1),
    ],
  },
  {
    key: "temperature",
    fields: rangeFields("°C", 0, 60, 0.1),
  },
  {
    key: "salinity",
    fields: rangeFields("ppt", 0, 60, 0.1),
  },
  {
    key: "waterLevel",
    fields: [
      ...rangeFields("%", 0, 100, 1),
      field("overflowTriggerDurationSec", "seconds", 0, undefined, 1),
    ],
  },
];

const AUTOMATION_FLAGS = [
  { key: "hypoxiaResponseEnabled" },
  { key: "rainOverflowResponseEnabled" },
  { key: "heatSalinityResponseEnabled" },
] as const;

interface SettingsViewProps {
  dataSource: PondDataSource;
  pondId: string;
  settings: PondSettings;
  onDirtyChange?(dirty: boolean): void;
  theme?: Theme;
  onThemeChange?(theme: Theme): void;
}

export function SettingsView({ dataSource, pondId, settings, onDirtyChange, theme = "dark", onThemeChange }: SettingsViewProps) {
  const { t } = useTranslation(["common", "settings", "errors"]);
  const [baseline, setBaseline] = useState(settings);
  const [formRevision, setFormRevision] = useState(0);
  const [errors, setErrors] = useState<SettingsValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState<PondSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  function markDirty() {
    if (dirty) return;
    setDirty(true);
    onDirtyChange?.(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const candidate = readSettingsForm(new FormData(event.currentTarget), baseline.mode);
    const validationErrors = validatePondSettings(candidate);
    setErrors(validationErrors);
    setFeedback(null);

    if (Object.keys(validationErrors).length > 0) return;

    setPendingSave(candidate);
  }

  async function confirmSave() {
    if (!pendingSave || saving) return;
    setSaving(true);
    try {
      const saved = await dataSource.updateSettings(pondId, {
        thresholds: pendingSave.thresholds,
        automation: pendingSave.automation,
      });
      setBaseline(saved);
      setFormRevision((current) => current + 1);
      setFeedback(t("saved", { ns: "settings" }));
      setPendingSave(null);
      setDirty(false);
      onDirtyChange?.(false);
    } catch (reason) {
      setFeedback(translateError(reason, "settingsSave", t));
    } finally {
      setSaving(false);
    }
  }

  function resetDraft() {
    setErrors({});
    setFeedback(t("resetDone", { ns: "settings" }));
    setDirty(false);
    onDirtyChange?.(false);
  }

  return (
    <div className="view-stack">
      <div className="page-heading page-heading--with-trailing">
        <div>
          <span className="eyebrow">{t("eyebrow", { ns: "settings" })}</span>
          <h1>{t("title", { ns: "settings" })}</h1>
          <p>{t("description", { ns: "settings" })}</p>
        </div>
        <span className="settings-mode"><Settings2 aria-hidden="true" /> {t("mode", { ns: "settings", mode: t(`mode.${settings.mode}`, { ns: "common" }) })}</span>
      </div>

      <aside className="protocol-note">
        <CloudRain aria-hidden="true" />
        <div>
          <strong>{t("rainBooleanTitle", { ns: "settings" })}</strong>
          <p>{t("rainBooleanDescription", { ns: "settings" })}</p>
        </div>
      </aside>

      <section className="appearance-panel" aria-labelledby="appearance-title">
        <div>
          <span className="eyebrow">{t("appearance.eyebrow", { ns: "settings" })}</span>
          <h2 id="appearance-title">{t("appearance.title", { ns: "settings" })}</h2>
          <p>{t("appearance.description", { ns: "settings" })}</p>
        </div>
        <div className="theme-switcher" role="group" aria-label={t("appearance.title", { ns: "settings" })}>
          <button className={theme === "light" ? "theme-option theme-option--active" : "theme-option"} type="button" aria-pressed={theme === "light"} onClick={() => onThemeChange?.("light")}>
            <Sun aria-hidden="true" /> {t("appearance.light", { ns: "settings" })}
          </button>
          <button className={theme === "dark" ? "theme-option theme-option--active" : "theme-option"} type="button" aria-pressed={theme === "dark"} onClick={() => onThemeChange?.("dark")}>
            <Moon aria-hidden="true" /> {t("appearance.dark", { ns: "settings" })}
          </button>
        </div>
      </section>

      <form key={formRevision} className="settings-form" onSubmit={(event) => void submit(event)} onReset={resetDraft} onChange={markDirty} noValidate>
        {Object.keys(errors).length > 0 && (
          <div className="settings-error-summary" role="alert">
            <strong>{t("invalidFields", { ns: "settings", count: Object.keys(errors).length })}</strong>
            <p>{t("invalidDescription", { ns: "settings" })}</p>
          </div>
        )}

        <div className="threshold-grid">
          {THRESHOLD_GROUPS.map((group) => {
            const groupValues = baseline.thresholds[group.key] as unknown as Record<string, number>;
            return (
              <fieldset key={group.key} className="threshold-card" data-threshold-section={group.key}>
                <legend>{t(`groups.${group.key}.label`, { ns: "settings" })}</legend>
                <p>{t(`groups.${group.key}.description`, { ns: "settings" })}</p>
                <div className="threshold-fields">
                  {group.fields.map((fieldDefinition) => {
                    const path = `thresholds.${group.key}.${fieldDefinition.key}`;
                    return (
                      <NumberField
                        key={path}
                        path={path}
                        definition={fieldDefinition}
                        defaultValue={groupValues[fieldDefinition.key]}
                        error={errors[path]}
                      />
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>

        <fieldset className="automation-panel">
          <legend>{t("automationTitle", { ns: "settings" })}</legend>
          <p>{t("automationDescription", { ns: "settings" })}</p>
          <div className="automation-grid">
            {AUTOMATION_FLAGS.map((flag) => (
              <label key={flag.key} className="automation-option">
                <input type="checkbox" name={`automation.${flag.key}`} defaultChecked={baseline.automation[flag.key]} />
                <span className="automation-switch" aria-hidden="true" />
                <span>
                  <strong>{t(`automation.${flag.key}.label`, { ns: "settings" })}</strong>
                  <small>{t(`automation.${flag.key}.description`, { ns: "settings" })}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="settings-actions">
          <div className="settings-feedback" aria-live="polite">{feedback}</div>
          <button className="button settings-reset" type="reset" disabled={saving}>
            <RotateCcw aria-hidden="true" /> {t("reset", { ns: "settings" })}
          </button>
          <button className="button button--primary" type="submit" disabled={saving}>
            <Save aria-hidden="true" /> {saving ? t("saving", { ns: "settings" }) : t("save", { ns: "settings" })}
          </button>
        </div>
      </form>
      {pendingSave && (
        <ConfirmationDialog
          title={t("confirmTitle", { ns: "settings" })}
          description={t("confirmDescription", { ns: "settings" })}
          confirmLabel={saving ? t("saving", { ns: "settings" }) : t("confirmSave", { ns: "settings" })}
          busy={saving}
          onConfirm={() => void confirmSave()}
          onCancel={() => setPendingSave(null)}
        />
      )}
    </div>
  );
}

function NumberField({
  path,
  definition,
  defaultValue,
  error,
}: {
  path: string;
  definition: NumberFieldDefinition;
  defaultValue: number;
  error?: SettingsValidationError;
}) {
  const { t } = useTranslation(["settings", "errors"]);
  const errorId = `${path.replaceAll(".", "-")}-error`;
  return (
    <label className="threshold-field">
      <span>{t(`fields.${definition.key}`, { ns: "settings" })}</span>
      <span className="threshold-input-wrap">
        <input
          type="number"
          name={path}
          defaultValue={defaultValue}
          min={definition.minimum}
          max={definition.maximum}
          step={definition.step ?? "any"}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        {definition.unit && <small>{definition.unit === "seconds" ? t("seconds", { ns: "settings" }) : definition.unit}</small>}
      </span>
      {error && <em id={errorId}>{t(`validation.${error.code}`, { ns: "errors", ...error.values })}</em>}
    </label>
  );
}

function readSettingsForm(formData: FormData, mode: OperatingMode): PondSettings {
  return {
    mode,
    thresholds: {
      ph: {
        normalMin: readNumber(formData, "thresholds.ph.normalMin"),
        normalMax: readNumber(formData, "thresholds.ph.normalMax"),
        warningLow: readNumber(formData, "thresholds.ph.warningLow"),
        warningHigh: readNumber(formData, "thresholds.ph.warningHigh"),
      },
      do: {
        normalMin: readNumber(formData, "thresholds.do.normalMin"),
        hypoxia: readNumber(formData, "thresholds.do.hypoxia"),
        critical: readNumber(formData, "thresholds.do.critical"),
        recovery: readNumber(formData, "thresholds.do.recovery"),
        triggerDurationSec: readNumber(formData, "thresholds.do.triggerDurationSec"),
      },
      temperature: {
        normalMin: readNumber(formData, "thresholds.temperature.normalMin"),
        normalMax: readNumber(formData, "thresholds.temperature.normalMax"),
        warningLow: readNumber(formData, "thresholds.temperature.warningLow"),
        warningHigh: readNumber(formData, "thresholds.temperature.warningHigh"),
      },
      salinity: {
        normalMin: readNumber(formData, "thresholds.salinity.normalMin"),
        normalMax: readNumber(formData, "thresholds.salinity.normalMax"),
        warningLow: readNumber(formData, "thresholds.salinity.warningLow"),
        warningHigh: readNumber(formData, "thresholds.salinity.warningHigh"),
      },
      waterLevel: {
        normalMin: readNumber(formData, "thresholds.waterLevel.normalMin"),
        normalMax: readNumber(formData, "thresholds.waterLevel.normalMax"),
        warningLow: readNumber(formData, "thresholds.waterLevel.warningLow"),
        warningHigh: readNumber(formData, "thresholds.waterLevel.warningHigh"),
        overflowTriggerDurationSec: readNumber(formData, "thresholds.waterLevel.overflowTriggerDurationSec"),
      },
    },
    automation: {
      hypoxiaResponseEnabled: formData.has("automation.hypoxiaResponseEnabled"),
      rainOverflowResponseEnabled: formData.has("automation.rainOverflowResponseEnabled"),
      heatSalinityResponseEnabled: formData.has("automation.heatSalinityResponseEnabled"),
    },
  };
}

function readNumber(formData: FormData, path: string): number {
  const value = formData.get(path);
  if (typeof value !== "string" || value.trim() === "") return Number.NaN;
  return Number(value);
}

function rangeFields(unit: string, minimum: number, maximum: number, step: number): NumberFieldDefinition[] {
  return [
    field("normalMin", unit, minimum, maximum, step),
    field("normalMax", unit, minimum, maximum, step),
    field("warningLow", unit, minimum, maximum, step),
    field("warningHigh", unit, minimum, maximum, step),
  ];
}

function field(
  key: string,
  unit: string,
  minimum: number,
  maximum?: number,
  step?: number,
): NumberFieldDefinition {
  return { key, unit, minimum, maximum, step };
}

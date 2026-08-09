import { useState, type FormEvent } from "react";
import { CloudRain, RotateCcw, Save, Settings2 } from "lucide-react";
import type { OperatingMode, PondSettings } from "../domain";
import type { PondDataSource } from "../data";
import { validatePondSettings, type SettingsValidationErrors } from "../settings/settingsValidation";

interface NumberFieldDefinition {
  key: string;
  label: string;
  unit?: string;
  step?: number;
  minimum: number;
  maximum?: number;
}

interface ThresholdGroupDefinition {
  key: keyof PondSettings["thresholds"];
  label: string;
  description: string;
  fields: NumberFieldDefinition[];
}

const THRESHOLD_GROUPS: ThresholdGroupDefinition[] = [
  {
    key: "ph",
    label: "pH",
    description: "Acidity and alkalinity operating bands.",
    fields: rangeFields("", 0, 14, 0.1),
  },
  {
    key: "do",
    label: "Dissolved oxygen",
    description: "Hypoxia workflow thresholds and sustained trigger time.",
    fields: [
      field("normalMin", "Normal minimum", "mg/L", 0, 30, 0.1),
      field("hypoxia", "Hypoxia", "mg/L", 0, 30, 0.1),
      field("critical", "Critical", "mg/L", 0, 30, 0.1),
      field("recovery", "Recovery", "mg/L", 0, 30, 0.1),
      field("triggerDurationSec", "Trigger duration", "seconds", 0, undefined, 1),
    ],
  },
  {
    key: "temperature",
    label: "Temperature",
    description: "Normal and warning water-temperature limits.",
    fields: rangeFields("°C", 0, 60, 0.1),
  },
  {
    key: "salinity",
    label: "Estimated salinity",
    description: "Salinity bands evaluated by the controller.",
    fields: rangeFields("ppt", 0, 60, 0.1),
  },
  {
    key: "waterLevel",
    label: "Water level",
    description: "Normal/warning bands and overflow persistence time.",
    fields: [
      ...rangeFields("%", 0, 100, 1),
      field("overflowTriggerDurationSec", "Overflow trigger duration", "seconds", 0, undefined, 1),
    ],
  },
];

const AUTOMATION_FLAGS = [
  {
    key: "hypoxiaResponseEnabled",
    label: "Hypoxia response",
    description: "Allow the device to run the configured low-oxygen workflow.",
  },
  {
    key: "rainOverflowResponseEnabled",
    label: "Rain overflow response",
    description: "Allow the device to respond when boolean rain and water-level conditions persist.",
  },
  {
    key: "heatSalinityResponseEnabled",
    label: "Heat and salinity response",
    description: "Allow the device to run the combined heat/salinity workflow.",
  },
] as const;

interface SettingsViewProps {
  dataSource: PondDataSource;
  pondId: string;
  settings: PondSettings;
}

export function SettingsView({ dataSource, pondId, settings }: SettingsViewProps) {
  const [baseline, setBaseline] = useState(settings);
  const [formRevision, setFormRevision] = useState(0);
  const [errors, setErrors] = useState<SettingsValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const candidate = readSettingsForm(new FormData(event.currentTarget), baseline.mode);
    const validationErrors = validatePondSettings(candidate);
    setErrors(validationErrors);
    setFeedback(null);

    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    try {
      const saved = await dataSource.updateSettings(pondId, {
        thresholds: candidate.thresholds,
        automation: candidate.automation,
      });
      setBaseline(saved);
      setFormRevision((current) => current + 1);
      setFeedback("Settings saved to the pond configuration.");
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Could not save pond settings.");
    } finally {
      setSaving(false);
    }
  }

  function resetDraft() {
    setErrors({});
    setFeedback("Unsaved changes reset.");
  }

  return (
    <div className="view-stack">
      <div className="page-heading page-heading--with-trailing">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>Thresholds and automation</h1>
          <p>These values map directly to the Firebase settings contract and are read by the IoT controller.</p>
        </div>
        <span className="settings-mode"><Settings2 aria-hidden="true" /> Mode: {titleCase(settings.mode)}</span>
      </div>

      <aside className="protocol-note">
        <CloudRain aria-hidden="true" />
        <div>
          <strong>Rain uses a boolean protocol value.</strong>
          <p>There is no rainfall-rate threshold in Firebase, so this form does not create one.</p>
        </div>
      </aside>

      <form key={formRevision} className="settings-form" onSubmit={(event) => void submit(event)} onReset={resetDraft} noValidate>
        {Object.keys(errors).length > 0 && (
          <div className="settings-error-summary" role="alert">
            <strong>Review {Object.keys(errors).length} invalid {Object.keys(errors).length === 1 ? "field" : "fields"}.</strong>
            <p>Threshold ordering and physical ranges must be valid before saving.</p>
          </div>
        )}

        <div className="threshold-grid">
          {THRESHOLD_GROUPS.map((group) => {
            const groupValues = baseline.thresholds[group.key] as unknown as Record<string, number>;
            return (
              <fieldset key={group.key} className="threshold-card">
                <legend>{group.label}</legend>
                <p>{group.description}</p>
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
          <legend>Automation workflows</legend>
          <p>Flags enable or disable device-owned automatic responses. They do not directly operate actuators.</p>
          <div className="automation-grid">
            {AUTOMATION_FLAGS.map((flag) => (
              <label key={flag.key} className="automation-option">
                <input type="checkbox" name={`automation.${flag.key}`} defaultChecked={baseline.automation[flag.key]} />
                <span className="automation-switch" aria-hidden="true" />
                <span>
                  <strong>{flag.label}</strong>
                  <small>{flag.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="settings-actions">
          <div className="settings-feedback" aria-live="polite">{feedback}</div>
          <button className="button settings-reset" type="reset" disabled={saving}>
            <RotateCcw aria-hidden="true" /> Reset
          </button>
          <button className="button button--primary" type="submit" disabled={saving}>
            <Save aria-hidden="true" /> {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
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
  error?: string;
}) {
  const errorId = `${path.replaceAll(".", "-")}-error`;
  return (
    <label className="threshold-field">
      <span>{definition.label}</span>
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
        {definition.unit && <small>{definition.unit}</small>}
      </span>
      {error && <em id={errorId}>{error}</em>}
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
    field("normalMin", "Normal minimum", unit, minimum, maximum, step),
    field("normalMax", "Normal maximum", unit, minimum, maximum, step),
    field("warningLow", "Warning low", unit, minimum, maximum, step),
    field("warningHigh", "Warning high", unit, minimum, maximum, step),
  ];
}

function field(
  key: string,
  label: string,
  unit: string,
  minimum: number,
  maximum?: number,
  step?: number,
): NumberFieldDefinition {
  return { key, label, unit, minimum, maximum, step };
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

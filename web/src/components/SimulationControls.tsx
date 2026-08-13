import { useEffect, useState } from "react";
import { FlaskConical, LoaderCircle, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { OperatingMode } from "../domain";
import type { PondDataSource, SimulationScenario, SimulationSnapshot } from "../data";

const SCENARIOS: ReadonlyArray<Exclude<SimulationScenario, "normal">> = [
  "hypoxia",
  "rain_overflow",
  "heat_salinity",
];

export function SimulationControls({
  dataSource,
  pondId,
  mode,
  connected,
}: {
  dataSource: PondDataSource;
  pondId: string;
  mode: OperatingMode | null;
  connected: boolean;
}) {
  const { t } = useTranslation("scenarios");
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>({ control: null, state: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => dataSource.subscribeSimulation(
    pondId,
    setSnapshot,
    () => setError(true),
  ), [dataSource, pondId]);

  const activeScenario = snapshot.state?.active ? snapshot.state.scenario : "normal";
  const awaitingDevice = Boolean(
    snapshot.control && snapshot.control.requestId !== snapshot.state?.requestId,
  );
  const disabled = submitting || mode !== "automatic" || !connected;

  async function request(scenario: Exclude<SimulationScenario, "normal"> | null) {
    setSubmitting(true);
    setError(false);
    try {
      await dataSource.requestSimulation(pondId, scenario);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="simulation-controls" aria-label={t("controlsAriaLabel")}>
      <div className="simulation-controls__heading">
        <FlaskConical aria-hidden="true" />
        <div>
          <span className="eyebrow">{t("controlTitle")}</span>
          <strong>{t("deviceOwned")}</strong>
        </div>
        {(submitting || awaitingDevice) && <LoaderCircle className="spin" aria-label={t("awaitingDevice")} />}
      </div>

      <div className="scenario-buttons">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario}
            type="button"
            className={`scenario-button${activeScenario === scenario ? " scenario-button--active" : ""}`}
            disabled={disabled}
            onClick={() => void request(scenario)}
          >
            {t(scenario)}
          </button>
        ))}
        <button
          type="button"
          className={`scenario-button scenario-button--stop${activeScenario === "normal" ? " scenario-button--active" : ""}`}
          disabled={disabled || activeScenario === "normal" && !awaitingDevice}
          onClick={() => void request(null)}
        >
          <Square aria-hidden="true" /> {t("stop")}
        </button>
      </div>

      <p className={error ? "simulation-controls__status simulation-controls__status--error" : "simulation-controls__status"}>
        {error
          ? t("requestFailed")
          : mode !== "automatic"
            ? t("automaticOnly")
            : !connected
              ? t("controllerOffline")
              : awaitingDevice
                ? t("awaitingDevice")
                : activeScenario === "normal"
                  ? t("inactive")
                  : t("active", { scenario: t(activeScenario) })}
      </p>
    </section>
  );
}

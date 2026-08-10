import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../StatusBadge";
import type { PondProbeKey, PondProbeReading } from "./pondSceneModel";

const SHORT_LABELS: Record<PondProbeKey, string> = {
  do: "DO",
  ph: "pH",
  temperature: "T°",
};

export function ProbeInspector({ probes, onActivate }: { probes: readonly PondProbeReading[]; onActivate(probe: PondProbeReading): void }) {
  const { t } = useTranslation("dashboard");
  const [hoveredProbe, setHoveredProbe] = useState<PondProbeKey | null>(null);
  const [selectedProbe, setSelectedProbe] = useState<PondProbeKey | null>(null);
  const activeKey = selectedProbe ?? hoveredProbe;
  const activeProbe = probes.find((probe) => probe.key === activeKey) ?? null;

  return (
    <div className="pond-3d-probes">
      {!activeProbe && <span className="pond-3d-probes__hint">{t("pond3d.probeHint")}</span>}
      {probes.map((probe) => (
        <button
          key={probe.key}
          type="button"
          className={`pond-3d-probe pond-3d-probe--${probe.key} pond-3d-probe--${probe.tone}`}
          aria-label={t("pond3d.probeAriaLabel", {
            sensor: probe.label,
            value: `${probe.value}${probe.unit ? ` ${probe.unit}` : ""}`,
            state: probe.state,
          })}
          aria-expanded={activeKey === probe.key}
          onMouseEnter={() => setHoveredProbe(probe.key)}
          onMouseLeave={() => setHoveredProbe(null)}
          onFocus={() => setHoveredProbe(probe.key)}
          onBlur={() => setHoveredProbe(null)}
          onClick={() => {
            setSelectedProbe((current) => current === probe.key ? null : probe.key);
            onActivate(probe);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSelectedProbe(null);
          }}
        >
          {SHORT_LABELS[probe.key]}
        </button>
      ))}
      {activeProbe && (
        <div className={`pond-3d-probe-card pond-3d-probe-card--${activeProbe.tone}`} role="status">
          <span>{activeProbe.label}</span>
          <strong>{activeProbe.value}{activeProbe.unit && <small>{activeProbe.unit}</small>}</strong>
          <StatusBadge label={activeProbe.state} tone={activeProbe.tone} />
        </div>
      )}
    </div>
  );
}

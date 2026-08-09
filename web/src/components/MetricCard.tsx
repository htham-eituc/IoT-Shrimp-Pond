import type { ReactNode } from "react";
import { Sparkline } from "./Sparkline";
import { StatusBadge } from "./StatusBadge";
import type { SensorTone } from "../presentation/sensorStatus";

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  rangeLabel: string;
  tone: SensorTone;
  history: number[];
}

const statusLabel = {
  normal: "Normal",
  warning: "Warning",
  critical: "Critical",
  info: "Live",
};

export function MetricCard({
  icon,
  label,
  value,
  unit,
  rangeLabel,
  tone,
  history,
}: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <span className="metric-card__icon" aria-hidden="true">{icon}</span>
        <StatusBadge label={statusLabel[tone]} tone={tone} compact />
      </div>
      <div>
        <h3>{label}</h3>
        <p className="metric-card__reading">
          {value}
          {unit && <span>{unit}</span>}
        </p>
      </div>
      <Sparkline values={history} tone={tone} label={label} />
      <p className="metric-card__range">{rangeLabel}</p>
    </article>
  );
}

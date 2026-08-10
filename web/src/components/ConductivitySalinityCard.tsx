import { Zap } from "lucide-react";
import type { ConductivitySalinityMetricViewModel } from "../presentation/metrics";
import { Sparkline } from "./Sparkline";
import { StatusBadge } from "./StatusBadge";

export function ConductivitySalinityCard({
  metric,
  id,
  highlighted = false,
}: {
  metric: ConductivitySalinityMetricViewModel;
  id?: string;
  highlighted?: boolean;
}) {
  return (
    <article
      id={id}
      className={`metric-card metric-card--${metric.tone} metric-card--compact metric-card--composite${highlighted ? " metric-card--highlighted" : ""}`}
      tabIndex={0}
    >
      <span className="metric-card__icon">
        <Zap aria-hidden="true" />
      </span>
      <div className="metric-card__composite-copy">
        <h3>{metric.label}</h3>
        <dl className="metric-card__dual-readings">
          <div className="metric-card__dual-row metric-card__dual-row--primary">
            <dt>{metric.salinityLabel}</dt>
            <dd>
              {metric.salinity.value}
              {metric.salinity.unit && <span>{metric.salinity.unit}</span>}
              <span className="sr-only">, {metric.salinity.state}</span>
            </dd>
            <Sparkline values={metric.trend} tone={metric.salinity.tone} />
          </div>
          <div className="metric-card__dual-row">
            <dt>{metric.conductivityLabel}</dt>
            <dd>
              {metric.conductivity.value}
              {metric.conductivity.unit && <span>{metric.conductivity.unit}</span>}
            </dd>
          </div>
        </dl>
      </div>
      <StatusBadge label={metric.state} tone={metric.tone} />
    </article>
  );
}

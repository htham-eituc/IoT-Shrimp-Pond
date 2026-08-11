import { CloudRain, Droplets, Gauge, Thermometer, Waves, Zap, Activity, type LucideIcon } from "lucide-react";
import type { MetricViewModel, SensorMetricKey } from "../presentation/metrics";
import { Sparkline } from "./Sparkline";
import { StatusBadge } from "./StatusBadge";

const metricIcons = {
  ph: Gauge,
  do: Droplets,
  temperature: Thermometer,
  waterLevel: Waves,
  rain: CloudRain,
  ec: Zap,
  salinity: Activity,
} satisfies Record<SensorMetricKey, LucideIcon>;

export function MetricCard({ metric, compact = false, id, highlighted = false }: { metric: MetricViewModel; compact?: boolean; id?: string; highlighted?: boolean }) {
  const Icon = metricIcons[metric.key];

  if (compact) {
    return (
      <article
        id={id}
        className={`metric-card metric-card--${metric.tone} metric-card--compact${highlighted ? " metric-card--highlighted" : ""}`}
        title={metric.safeRange}
        tabIndex={0}
      >
        <div className="metric-card__header">
          <span className="metric-card__icon">
            <Icon aria-hidden="true" />
          </span>
          <h3>{metric.label}</h3>
          <StatusBadge label={metric.state} tone={metric.tone} />
        </div>
        <div className="metric-card__body metric-card__compact-copy">
          <p className="metric-card__reading">
            {metric.value}
            {metric.unit && <span>{metric.unit}</span>}
          </p>
        </div>
        <div className="metric-card__trend">
          <Sparkline values={metric.trend} tone={metric.tone} />
        </div>
        <span className="sr-only">{metric.safeRange}</span>
      </article>
    );
  }

  return (
    <article className={`metric-card metric-card--${metric.tone}`}>
      <div className="metric-card__top">
        <span className="metric-card__icon">
          <Icon aria-hidden="true" />
        </span>
        <StatusBadge label={metric.state} tone={metric.tone} />
      </div>
      <div>
        <h3>{metric.label}</h3>
        <p className="metric-card__reading">
          {metric.value}
          {metric.unit && <span>{metric.unit}</span>}
        </p>
      </div>
      <Sparkline values={metric.trend} tone={metric.tone} />
      <p className="metric-card__range">{metric.safeRange}</p>
    </article>
  );
}

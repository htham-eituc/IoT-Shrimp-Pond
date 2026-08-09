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

export function MetricCard({ metric }: { metric: MetricViewModel }) {
  const Icon = metricIcons[metric.key];

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

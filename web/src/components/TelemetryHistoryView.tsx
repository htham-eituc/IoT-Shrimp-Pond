import { useMemo } from "react";
import { CloudRain, History } from "lucide-react";
import type { KeyedRecord, TelemetryRecord } from "../domain";
import {
  HISTORY_METRICS,
  buildTelemetryChartGeometry,
  chronologicalTelemetry,
  type HistoryMetricDefinition,
} from "../history/telemetryHistory";

interface TelemetryHistoryViewProps {
  records: Array<KeyedRecord<TelemetryRecord>>;
  loading: boolean;
}

export function TelemetryHistoryView({ records, loading }: TelemetryHistoryViewProps) {
  const chronologicalRecords = useMemo(() => chronologicalTelemetry(records), [records]);

  if (loading) {
    return (
      <div className="state-panel state-panel--info" role="status">
        <strong>Loading telemetry history</strong>
        <p>Reading the most recent records for this pond.</p>
      </div>
    );
  }

  if (chronologicalRecords.length === 0) {
    return (
      <div className="history-empty" role="status">
        <History aria-hidden="true" />
        <strong>No telemetry history</strong>
        <p>The device has not published any historical records for this pond.</p>
      </div>
    );
  }

  const firstTimestamp = chronologicalRecords[0].value.timestampMs;
  const lastTimestamp = chronologicalRecords.at(-1)!.value.timestampMs;
  const rainyRecords = chronologicalRecords.filter((record) => record.value.rain);

  return (
    <div className="view-stack">
      <div className="page-heading page-heading--with-trailing">
        <div>
          <span className="eyebrow">Telemetry history</span>
          <h1>Recent water-quality records</h1>
          <p>Device-published telemetry shown in chronological order. No prediction or diagnosis is applied.</p>
        </div>
        <span className="history-count">{chronologicalRecords.length} records</span>
      </div>

      <section className="history-range" aria-label="History time range">
        <span><strong>From</strong> {formatTimestamp(firstTimestamp)}</span>
        <span><strong>To</strong> {formatTimestamp(lastTimestamp)}</span>
        <span className={rainyRecords.length > 0 ? "history-rain history-rain--active" : "history-rain"}>
          <CloudRain aria-hidden="true" /> {rainyRecords.length} rain {rainyRecords.length === 1 ? "sample" : "samples"}
        </span>
      </section>

      <div className="history-chart-grid">
        {HISTORY_METRICS.map((metric) => (
          <TelemetryChart key={metric.key} metric={metric} records={chronologicalRecords} />
        ))}
      </div>

      <p className="history-legend"><span aria-hidden="true" /> Blue shaded regions mark records where <code>rain</code> was <code>true</code>.</p>
    </div>
  );
}

function TelemetryChart({
  metric,
  records,
}: {
  metric: HistoryMetricDefinition;
  records: Array<KeyedRecord<TelemetryRecord>>;
}) {
  const geometry = buildTelemetryChartGeometry(records, metric.key);
  const points = geometry.points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const first = records[0].value.timestampMs;
  const last = records.at(-1)!.value.timestampMs;
  const current = records.at(-1)!.value[metric.key];
  const summary = `${metric.label}: ${records.length} records, minimum ${formatValue(geometry.min, metric)}, maximum ${formatValue(geometry.max, metric)}, latest ${formatValue(current, metric)}.`;

  return (
    <article className="history-chart-card">
      <header>
        <div>
          <span className="eyebrow">{metric.key}</span>
          <h2>{metric.label}</h2>
        </div>
        <strong>{formatValue(current, metric)}</strong>
      </header>
      <div className="history-chart" role="img" aria-label={summary}>
        <svg viewBox="0 0 600 170" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`history-fill-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.24" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line className="history-gridline" x1="0" y1="42.5" x2="600" y2="42.5" />
          <line className="history-gridline" x1="0" y1="85" x2="600" y2="85" />
          <line className="history-gridline" x1="0" y1="127.5" x2="600" y2="127.5" />
          {geometry.rainRegions.map((region, index) => (
            <rect key={`${region.x}-${index}`} className="history-rain-region" x={region.x} y="0" width={region.width} height="170" />
          ))}
          <polygon points={`0,170 ${points} 600,170`} fill={`url(#history-fill-${metric.key})`} />
          <polyline className="history-line" points={points} />
          {geometry.points.map((point, index) => (
            <circle key={`${point.x}-${index}`} className="history-point" cx={point.x} cy={point.y} r="2.6" />
          ))}
        </svg>
      </div>
      <footer>
        <time dateTime={new Date(first).toISOString()}>{formatShortTime(first)}</time>
        <span>{formatValue(geometry.min, metric)} – {formatValue(geometry.max, metric)}</span>
        <time dateTime={new Date(last).toISOString()}>{formatShortTime(last)}</time>
      </footer>
    </article>
  );
}

function formatValue(value: number, metric: HistoryMetricDefinition): string {
  return `${value.toFixed(metric.decimals)}${metric.unit ? ` ${metric.unit}` : ""}`;
}

function formatTimestamp(timestampMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestampMs);
}

function formatShortTime(timestampMs: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(timestampMs);
}

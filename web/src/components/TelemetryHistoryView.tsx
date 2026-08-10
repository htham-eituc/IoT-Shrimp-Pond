import { useMemo } from "react";
import { CloudRain, History } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { KeyedRecord, TelemetryRecord } from "../domain";
import {
  HISTORY_METRICS,
  buildTelemetryChartGeometry,
  chronologicalTelemetry,
  type HistoryMetricDefinition,
} from "../history/telemetryHistory";
import { useLocaleFormatters } from "../i18n/formatters";

interface TelemetryHistoryViewProps {
  records: Array<KeyedRecord<TelemetryRecord>>;
  loading: boolean;
}

export function TelemetryHistoryView({ records, loading }: TelemetryHistoryViewProps) {
  const { t } = useTranslation(["common", "history"]);
  const formatters = useLocaleFormatters();
  const chronologicalRecords = useMemo(() => chronologicalTelemetry(records), [records]);

  if (loading) {
    return (
      <div className="state-panel state-panel--info" role="status">
        <strong>{t("loading", { ns: "history" })}</strong>
        <p>{t("loadingDescription", { ns: "history" })}</p>
      </div>
    );
  }

  if (chronologicalRecords.length === 0) {
    return (
      <div className="history-empty" role="status">
        <History aria-hidden="true" />
        <strong>{t("empty", { ns: "history" })}</strong>
        <p>{t("emptyDescription", { ns: "history" })}</p>
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
          <span className="eyebrow">{t("eyebrow", { ns: "history" })}</span>
          <h1>{t("title", { ns: "history" })}</h1>
          <p>{t("description", { ns: "history" })}</p>
        </div>
        <span className="history-count">{t("records", { ns: "history", count: chronologicalRecords.length })}</span>
      </div>

      <section className="history-range" aria-label={t("rangeAriaLabel", { ns: "history" })}>
        <span><strong>{t("from", { ns: "common" })}</strong> {formatters.timestamp(firstTimestamp)}</span>
        <span><strong>{t("to", { ns: "common" })}</strong> {formatters.timestamp(lastTimestamp)}</span>
        <span className={rainyRecords.length > 0 ? "history-rain history-rain--active" : "history-rain"}>
          <CloudRain aria-hidden="true" /> {t("rainSamples", { ns: "history", count: rainyRecords.length })}
        </span>
      </section>

      <div className="history-chart-grid">
        {HISTORY_METRICS.map((metric) => (
          <TelemetryChart key={metric.key} metric={metric} records={chronologicalRecords} />
        ))}
      </div>

      <p className="history-legend"><span aria-hidden="true" /> {t("rainLegend", { ns: "history" })}</p>
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
  const { t } = useTranslation(["history", "sensors"]);
  const formatters = useLocaleFormatters();
  const geometry = buildTelemetryChartGeometry(records, metric.key);
  const points = geometry.points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const first = records[0].value.timestampMs;
  const last = records.at(-1)!.value.timestampMs;
  const current = records.at(-1)!.value[metric.key];
  const label = t(`${metric.key}.label`, { ns: "sensors" });
  const formatValue = (value: number) => `${formatters.number(value, { minimumFractionDigits: metric.decimals, maximumFractionDigits: metric.decimals })}${metric.unit ? ` ${metric.unit}` : ""}`;
  const summary = t("chartSummary", {
    ns: "history",
    metric: label,
    count: records.length,
    min: formatValue(geometry.min),
    max: formatValue(geometry.max),
    latest: formatValue(current),
  });

  return (
    <article className="history-chart-card">
      <header>
        <div>
          <span className="eyebrow">{t("sensorEyebrow", { ns: "history" })}</span>
          <h2>{label}</h2>
        </div>
        <strong>{formatValue(current)}</strong>
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
        <time dateTime={new Date(first).toISOString()}>{formatters.date(first, { hour: "2-digit", minute: "2-digit" })}</time>
        <span>{formatValue(geometry.min)} – {formatValue(geometry.max)}</span>
        <time dateTime={new Date(last).toISOString()}>{formatters.date(last, { hour: "2-digit", minute: "2-digit" })}</time>
      </footer>
    </article>
  );
}

import type { MetricTone } from "../presentation/metrics";

export function Sparkline({ values, tone }: { values: number[]; tone: MetricTone }) {
  if (values.length < 3) {
    return <div className="sparkline sparkline--empty" aria-hidden="true" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 32 - ((value - min) / range) * 28;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className={`sparkline sparkline--${tone}`} viewBox="0 0 100 36" aria-hidden="true" focusable="false">
      <polyline points={points} />
    </svg>
  );
}

import { AlertTriangle, CheckCircle2, Info, WifiOff } from "lucide-react";
import type { MetricTone } from "../presentation/metrics";

interface StatusBadgeProps {
  label: string;
  tone: MetricTone;
}

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  const Icon = tone === "critical" ? AlertTriangle : tone === "offline" ? WifiOff : tone === "info" ? Info : CheckCircle2;
  return (
    <span className={`status-badge status-badge--${tone}`}>
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}

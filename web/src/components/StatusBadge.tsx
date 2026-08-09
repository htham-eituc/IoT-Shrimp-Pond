import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  LoaderCircle,
  XCircle,
} from "lucide-react";
import type { PondStatus } from "../domain/pond";

export type BadgeTone = PondStatus | "info" | "offline" | "pending";

interface StatusBadgeProps {
  label: string;
  tone: BadgeTone;
  compact?: boolean;
}

const iconByTone = {
  normal: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
  info: CircleHelp,
  offline: XCircle,
  pending: LoaderCircle,
};

export function StatusBadge({ label, tone, compact = false }: StatusBadgeProps) {
  const Icon = iconByTone[tone];

  return (
    <span
      className={`status-badge status-badge--${tone}${compact ? " status-badge--compact" : ""}`}
    >
      <Icon aria-hidden="true" className={tone === "pending" ? "spin" : ""} />
      {label}
    </span>
  );
}

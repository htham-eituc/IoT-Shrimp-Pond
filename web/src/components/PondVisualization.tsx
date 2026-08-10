import type { PondState } from "../domain";
import { useTranslation } from "react-i18next";
import { useLocaleFormatters } from "../i18n/formatters";

export function PondVisualization({ pond }: { pond: PondState }) {
  const { t } = useTranslation(["common", "dashboard", "devices"]);
  const formatters = useLocaleFormatters();
  const waterY = 250 - (clamp(pond.sensors.waterLevel, 0, 100) / 100) * 140;
  const waterHeight = 250 - waterY;
  const statusTone = pond.status;

  return (
    <div className={`pond-scene pond-scene--${statusTone}`} aria-label={createPondDescription(pond, t, formatters.percentage)}>
      <svg className="pond-scene__svg" viewBox="0 0 620 300" role="img">
        <title>{t("overview.visualizationAriaTitle", { ns: "dashboard" })}</title>
        <desc>{createPondDescription(pond, t, formatters.percentage)}</desc>
        <defs>
          <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a8fae" />
            <stop offset="100%" stopColor="#0d3a4d" />
          </linearGradient>
        </defs>

        <path d="M30 90 L100 60 L520 60 L590 90 L590 260 L30 260 Z" fill="#173347" stroke="#1f4256" strokeWidth="2" />
        <rect x="50" y={waterY} width="520" height={waterHeight} rx="4" fill="url(#waterGrad)" />
        <line className="pond-waterline" x1="50" y1={waterY} x2="570" y2={waterY} stroke="#8fd8ea" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.65" />

        {pond.sensors.rain && (
          <g className="pond-rain" stroke="#5FA8D3" strokeWidth="2" strokeLinecap="round">
            {[120, 170, 230, 300, 380, 450, 500].map((x) => (
              <line key={x} x1={x} y1="8" x2={x - 8} y2="34" />
            ))}
          </g>
        )}

        <PaddleWheel x={150} y={120} active={pond.devices.aerator} />
        <PaddleWheel x={470} y={120} active={pond.devices.aerator} />

        {pond.devices.aerator && (
          <g className="pond-bubbles">
            <circle cx="180" cy="235" r="3" />
            <circle cx="196" cy="240" r="2" />
            <circle cx="430" cy="235" r="3" />
            <circle cx="446" cy="242" r="2" />
            <circle cx="310" cy="238" r="2.5" />
          </g>
        )}

        <Probe x={240} label="DO" active={pond.sensors.do >= 5.5} />
        <Probe x={300} label="pH" active={pond.sensors.ph >= 7.5 && pond.sensors.ph <= 8.5} />
        <Probe x={360} label="T°" active={pond.sensors.temperature >= 28 && pond.sensors.temperature <= 32} />

        <Pump kind="drain" active={pond.devices.drainagePump} label={t("drainagePump.short", { ns: "devices" })} />
        <Pump kind="intake" active={pond.devices.dilutionPump} label={t("dilutionPump.short", { ns: "devices" })} />
        <Feeder active={pond.devices.feeder} label={t("feeder.short", { ns: "devices" })} />

        {(pond.devices.buzzer || pond.devices.warningBeacon || pond.status !== "normal") && (
          <g className={`pond-warning pond-warning--${pond.status}`}>
            <circle cx="540" cy="78" r="15" />
            <text x="540" y="82" textAnchor="middle">!</text>
          </g>
        )}

        <text x="580" y="256" textAnchor="end" className="pond-level-label">
          {t("overview.waterLevelLabel", { ns: "dashboard", value: formatters.percentage(pond.sensors.waterLevel, { maximumFractionDigits: 0 }) })}
        </text>
      </svg>
      <div className="pond-scene__legend" aria-hidden="true">
        <span><i className="legend-dot legend-dot--info" />{t("overview.rainAndFlow", { ns: "dashboard" })}</span>
        <span><i className="legend-dot legend-dot--normal" />{t("overview.runningLegend", { ns: "dashboard" })}</span>
        <span><i className={`legend-dot legend-dot--${pond.status}`} />{t("overview.pondStatusLegend", { ns: "dashboard" })}</span>
      </div>
    </div>
  );
}

function PaddleWheel({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle className="pond-wheel-ring" r="26" />
      <g className={active ? "pond-wheel pond-wheel--running" : "pond-wheel"}>
        <rect x="-2" y="-22" width="4" height="44" />
        <rect x="-22" y="-2" width="44" height="4" />
        <rect x="-16" y="-16" width="4" height="32" transform="rotate(45)" />
        <rect x="-16" y="-16" width="32" height="4" transform="rotate(45)" />
      </g>
    </g>
  );
}

function Probe({ x, label, active }: { x: number; label: string; active: boolean }) {
  return (
    <g>
      <line x1={x} y1="70" x2={x} y2="112" className="pond-probe-line" />
      <circle cx={x} cy="112" r="5" className={active ? "pond-probe-dot pond-probe-dot--normal" : "pond-probe-dot pond-probe-dot--warning"} />
      <text x={x} y="55" textAnchor="middle" className="pond-probe-label">{label}</text>
    </g>
  );
}

function Pump({ kind, active, label }: { kind: "drain" | "intake"; active: boolean; label: string }) {
  if (kind === "drain") {
    return (
      <g className={active ? "pond-pump pond-pump--active" : "pond-pump"}>
        <rect x="22" y="115" width="18" height="26" rx="3" />
        <text x="31" y="153" textAnchor="middle">{label}</text>
        <path d="M40 126 H58" />
      </g>
    );
  }

  return (
    <g className={active ? "pond-pump pond-pump--active" : "pond-pump"}>
      <rect x="580" y="150" width="18" height="30" rx="3" />
      <text x="589" y="192" textAnchor="middle">{label}</text>
      <path d="M580 165 H562" />
    </g>
  );
}

function Feeder({ active, label }: { active: boolean; label: string }) {
  return (
    <g className={active ? "pond-feeder pond-feeder--active" : "pond-feeder"} transform="translate(305 84)">
      <path d="M0 -16 L18 -4 L12 15 H-12 L-18 -4 Z" />
      <text x="0" y="30" textAnchor="middle">{label}</text>
    </g>
  );
}

function createPondDescription(
  pond: PondState,
  t: (key: string, options?: Record<string, unknown>) => string,
  percentage: (value: number, options?: Intl.NumberFormatOptions) => string,
): string {
  return t("overview.visualizationDescription", {
    ns: "dashboard",
    status: t(`status.${pond.status}`, { ns: "common" }),
    waterLevel: percentage(pond.sensors.waterLevel, { maximumFractionDigits: 0 }),
    rain: t(pond.sensors.rain ? "boolean.true" : "boolean.false", { ns: "common" }),
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

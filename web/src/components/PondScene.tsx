import { useId } from "react";
import type { PondState } from "../domain";
import type { SensorTone } from "../presentation/sensorStatus";

interface PondSceneProps {
  pond: PondState;
  pendingDevices?: ReadonlySet<keyof PondState["devices"]>;
  probeTones?: Partial<Record<"do" | "ph" | "temperature", SensorTone>>;
}

export function PondScene({ pond, pendingDevices = new Set(), probeTones = {} }: PondSceneProps) {
  const gradientId = `pond-water-${useId().replaceAll(":", "")}`;
  const waterTop = 286 - (pond.sensors.waterLevel / 100) * 166;
  const waterHeight = 286 - waterTop;
  const aeratorClass = pond.devices.aerator ? "pond-wheel pond-wheel--running" : "pond-wheel";

  const description = [
    `Water level ${Math.round(pond.sensors.waterLevel)} percent.`,
    pond.sensors.rain ? "Rain detected." : "No rain detected.",
    `Aerator ${pond.devices.aerator ? "on" : "off"}.`,
    `Drainage pump ${pond.devices.drainagePump ? "on" : "off"}.`,
    `Dilution pump ${pond.devices.dilutionPump ? "on" : "off"}.`,
  ].join(" ");

  return (
    <div className={`pond-scene pond-scene--${pond.status}`}>
      <svg
        viewBox="0 0 720 360"
        className="pond-scene__svg"
        role="img"
        aria-label={description}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a9fc0" />
            <stop offset="55%" stopColor="#17657b" />
            <stop offset="100%" stopColor="#0a3a4b" />
          </linearGradient>
          <linearGradient id={`${gradientId}-bank`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#245362" />
            <stop offset="100%" stopColor="#102f3c" />
          </linearGradient>
          <filter id={`${gradientId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d="M26 112 102 72h516l76 40v198H26Z"
          fill={`url(#${gradientId}-bank)`}
          stroke="rgba(145, 203, 211, .22)"
          strokeWidth="2"
        />
        <rect
          x="58"
          y={waterTop}
          width="604"
          height={waterHeight}
          rx="6"
          fill={`url(#${gradientId})`}
        />
        <path
          d={`M58 ${waterTop} Q 135 ${waterTop - 5} 210 ${waterTop} T 360 ${waterTop} T 510 ${waterTop} T 662 ${waterTop}`}
          fill="none"
          stroke="#a1e6ed"
          strokeOpacity=".72"
          strokeWidth="2"
          strokeDasharray="7 7"
          className="pond-waterline"
        />

        {pond.sensors.rain && (
          <g className="pond-rain" stroke="#76c8ee" strokeWidth="3" strokeLinecap="round">
            {Array.from({ length: 11 }, (_, index) => (
              <line
                key={index}
                x1={82 + index * 54}
                y1={20 + (index % 3) * 9}
                x2={72 + index * 54}
                y2={48 + (index % 3) * 9}
              />
            ))}
          </g>
        )}

        {([
          ["DO", probeTones.do],
          ["pH", probeTones.ph],
          ["T°", probeTones.temperature],
        ] as const).map(([label, tone], index) => (
          <g key={label} transform={`translate(${286 + index * 72}, 0)`}>
            <text x="0" y="52" textAnchor="middle" className="pond-probe-label">
              {label}
            </text>
            <line x1="0" y1="62" x2="0" y2={Math.max(126, waterTop + 18)} className="pond-probe-line" />
            <circle
              cx="0"
              cy={Math.max(126, waterTop + 18)}
              r="6"
              className={`pond-probe-dot pond-probe-dot--${tone ?? "info"}`}
              filter={`url(#${gradientId}-glow)`}
            />
          </g>
        ))}

        {[178, 544].map((x) => (
          <g key={x} transform={`translate(${x} ${Math.max(112, waterTop + 8)})`}>
            <circle r="28" className="pond-wheel-ring" />
            <g className={aeratorClass}>
              <path d="M0-24V24M-24 0H24M-17-17 17 17M17-17-17 17" />
              <circle r="4" />
            </g>
            {pond.devices.aerator && (
              <g className="pond-bubbles">
                <circle cx="-11" cy="82" r="4" />
                <circle cx="4" cy="96" r="3" style={{ animationDelay: ".55s" }} />
                <circle cx="15" cy="75" r="2.5" style={{ animationDelay: "1.1s" }} />
              </g>
            )}
          </g>
        ))}

        <DeviceMarker
          x={42}
          y={205}
          label="DRAIN"
          active={pond.devices.drainagePump}
          pending={pendingDevices.has("drainagePump")}
          direction="out"
        />
        <DeviceMarker
          x={678}
          y={238}
          label="DILUTE"
          active={pond.devices.dilutionPump}
          pending={pendingDevices.has("dilutionPump")}
          direction="in"
        />

        <g transform="translate(610 84)" className={pond.devices.feeder ? "pond-feeder pond-feeder--active" : "pond-feeder"}>
          <path d="M-18-12h36l-5 25h-26Z" />
          <path d="M0-27v14M-7-20l7 7 7-7" />
          <text y="29" textAnchor="middle">FEEDER</text>
        </g>

        <text x="642" y="332" textAnchor="end" className="pond-level-label">
          WATER LEVEL · {Math.round(pond.sensors.waterLevel)}%
        </text>
      </svg>

      <div className="pond-scene__legend" aria-hidden="true">
        <span><i className={pond.sensors.rain ? "legend-dot legend-dot--info" : "legend-dot legend-dot--normal"} />{pond.sensors.rain ? "Rain detected" : "No rain"}</span>
        <span><i className={pond.devices.aerator ? "legend-dot legend-dot--normal" : "legend-dot"} />Aerator {pond.devices.aerator ? "running" : "idle"}</span>
        <span><i className={`legend-dot legend-dot--${pond.status}`} />Pond {pond.status}</span>
      </div>
    </div>
  );
}

interface DeviceMarkerProps {
  x: number;
  y: number;
  label: string;
  active: boolean;
  pending: boolean;
  direction: "in" | "out";
}

function DeviceMarker({ x, y, label, active, pending, direction }: DeviceMarkerProps) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      className={`pond-pump${active ? " pond-pump--active" : ""}${pending ? " pond-pump--pending" : ""}`}
    >
      <rect x="-16" y="-20" width="32" height="40" rx="7" />
      <circle r="7" />
      <path d={direction === "in" ? "M-42 0h22m-8-8 8 8-8 8" : "M20 0h22m-8-8 8 8-8 8"} />
      <text y="34" textAnchor="middle">{label}</text>
    </g>
  );
}

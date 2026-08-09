import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  BellRing,
  Circle,
  Gauge,
  History,
  LayoutDashboard,
  LogOut,
  Settings2,
  SlidersHorizontal,
  UserRound,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { DashboardSession } from "../domain/session";
import type { CommandDevice, KeyedRecord, PondAlert, PondSettings, PondState, TelemetryRecord } from "../domain";
import type { DemoScenario, PondDataSource } from "../data";
import { isDemoScenarioSource } from "../data";
import { usePondDashboard } from "../hooks/usePondDashboard";
import { createMetricViewModels } from "../presentation/metrics";
import { ActiveAlertsPanel } from "./ActiveAlertsPanel";
import { AlertsEventsView } from "./AlertsEventsView";
import { DeviceControlPanel } from "./DeviceControlPanel";
import { MetricCard } from "./MetricCard";
import { PondVisualization } from "./PondVisualization";
import { SettingsView } from "./SettingsView";
import { StatusBadge } from "./StatusBadge";
import { TelemetryHistoryView } from "./TelemetryHistoryView";

type NavKey = "overview" | "realtime" | "control" | "history" | "settings" | "alerts";

const NAV_ITEMS: ReadonlyArray<{ key: NavKey; label: string; icon: LucideIcon }> = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "realtime", label: "Realtime", icon: Gauge },
  { key: "control", label: "Control", icon: SlidersHorizontal },
  { key: "history", label: "History", icon: History },
  { key: "settings", label: "Settings / Thresholds", icon: Settings2 },
  { key: "alerts", label: "Alerts & Events", icon: BellRing },
];

const DEMO_SCENARIOS: ReadonlyArray<{ key: DemoScenario; label: string }> = [
  { key: "normal", label: "Normal" },
  { key: "hypoxia", label: "Hypoxia" },
  { key: "rain_overflow", label: "Rain overflow" },
  { key: "heat_salinity", label: "Heat + salinity" },
];

interface AppShellProps {
  dataSource: PondDataSource;
  session: DashboardSession;
  onLogout(): void;
}

export function AppShell({ dataSource, session, onLogout }: AppShellProps) {
  const [activeView, setActiveView] = useState<NavKey>("overview");
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario>("normal");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dashboard = usePondDashboard(dataSource, session.profile.pondId);
  const activeItem = NAV_ITEMS.find((item) => item.key === activeView) ?? NAV_ITEMS[0];

  function onNavKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = NAV_ITEMS.findIndex((item) => item.key === activeView);
    const lastIndex = NAV_ITEMS.length - 1;
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    if (event.key === "ArrowLeft") nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lastIndex;

    if (nextIndex !== currentIndex) {
      event.preventDefault();
      const nextItem = NAV_ITEMS[nextIndex];
      setActiveView(nextItem.key);
      tabRefs.current[nextIndex]?.focus();
    }
  }

  function selectScenario(scenario: DemoScenario) {
    setSelectedScenario(scenario);
    if (isDemoScenarioSource(dataSource)) {
      dataSource.setDemoScenario(session.profile.pondId, scenario);
    }
  }

  const pondName = dashboard.pond?.name ?? session.pond.name;
  const connected = dashboard.pond?.connected ?? session.pond.connected;
  const mode = dashboard.settings?.mode ?? session.pond.mode;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand-lockup" href="#main-content" aria-label="Smart Shrimp Pond dashboard">
          <span className="brand-mark" aria-hidden="true">
            <Waves />
          </span>
          <span>
            <strong>Smart Shrimp Pond</strong>
            <small>Aquaculture operations dashboard</small>
          </span>
        </a>

        <div className="topbar-context" aria-label="Current pond context">
          <PondIdentity name={pondName} />
          <StatusPill label={connected ? "Online" : "Offline"} tone={connected ? "normal" : "offline"} />
          <StatusPill label={titleCase(mode)} tone="info" />
          <div className="operator-chip">
            <UserRound aria-hidden="true" />
            <span>
              <strong>{session.profile.displayName}</strong>
              <small>{session.profile.pondId}</small>
            </span>
          </div>
          <button className="icon-button" type="button" onClick={onLogout} aria-label="Log out">
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav className="app-nav" aria-label="Dashboard navigation">
        <div className="app-nav-inner" role="tablist" aria-orientation="horizontal" onKeyDown={onNavKeyDown}>
          {NAV_ITEMS.map(({ key, label, icon: Icon }, index) => (
            <button
              key={key}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              className={key === activeView ? "nav-tab nav-tab--active" : "nav-tab"}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={key === activeView}
              aria-controls={`panel-${key}`}
              tabIndex={key === activeView ? 0 : -1}
              onClick={() => setActiveView(key)}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="dashboard-main" id="main-content">
        <section
          className="view-panel"
          id={`panel-${activeView}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeView}`}
          tabIndex={0}
        >
          <DashboardContent
            dataSource={dataSource}
            pondId={session.profile.pondId}
            activeView={activeView}
            activeLabel={activeItem.label}
            selectedScenario={selectedScenario}
            onScenarioChange={selectScenario}
            dashboard={dashboard}
          />
        </section>
      </main>
    </div>
  );
}

function DashboardContent({
  dataSource,
  pondId,
  activeView,
  activeLabel,
  selectedScenario,
  onScenarioChange,
  dashboard,
}: {
  dataSource: PondDataSource;
  pondId: string;
  activeView: NavKey;
  activeLabel: string;
  selectedScenario: DemoScenario;
  onScenarioChange(scenario: DemoScenario): void;
  dashboard: ReturnType<typeof usePondDashboard>;
}) {
  if (dashboard.loading && !dashboard.pond) {
    return <StatePanel title="Loading pond data" description="Opening mock Realtime Database subscriptions." tone="info" />;
  }

  if (dashboard.error) {
    return <StatePanel title="Dashboard data unavailable" description={dashboard.error} tone="critical" />;
  }

  if (!dashboard.pond) {
    return <StatePanel title="No pond data" description="No Firebase-shaped mock state exists for this assigned pond." tone="warning" />;
  }

  if (activeView === "overview") {
    return (
      <OverviewView
        pond={dashboard.pond}
        settingsMode={dashboard.settings?.mode ?? "automatic"}
        alerts={dashboard.alerts}
        selectedScenario={selectedScenario}
        onScenarioChange={onScenarioChange}
      />
    );
  }

  if (activeView === "realtime") {
    return (
      <RealtimeView
        pond={dashboard.pond}
        settings={dashboard.settings}
        alerts={dashboard.alerts}
        telemetry={dashboard.telemetry}
      />
    );
  }

  if (activeView === "control") {
    if (!dashboard.settings) {
      return <StatePanel title="Settings unavailable" description="Operating mode must be loaded before device commands can be created." tone="warning" />;
    }

    return (
      <DeviceControlPanel
        dataSource={dataSource}
        pondId={pondId}
        connected={dashboard.pond.connected}
        devices={dashboard.pond.devices}
        settings={dashboard.settings}
        commands={dashboard.commands}
      />
    );
  }

  if (activeView === "history") {
    return <TelemetryHistoryView records={dashboard.telemetry} loading={dashboard.loading} />;
  }

  if (activeView === "settings") {
    if (!dashboard.settings) {
      return <StatePanel title="Settings unavailable" description="No Firebase-shaped settings exist for this assigned pond." tone="warning" />;
    }

    return <SettingsView dataSource={dataSource} pondId={pondId} settings={dashboard.settings} />;
  }

  if (activeView === "alerts") {
    return <AlertsEventsView alerts={dashboard.alerts} events={dashboard.events} />;
  }

  return (
    <StatePanel title={`${activeLabel} unavailable`} description="This dashboard view could not be selected." tone="warning" />
  );
}

function OverviewView({
  pond,
  settingsMode,
  alerts,
  selectedScenario,
  onScenarioChange,
}: {
  pond: PondState;
  settingsMode: string;
  alerts: Array<KeyedRecord<PondAlert>>;
  selectedScenario: DemoScenario;
  onScenarioChange(scenario: DemoScenario): void;
}) {
  const activeAlerts = alerts.filter((alert) => alert.value.status === "active");
  const runningDevices = Object.values(pond.devices).filter(Boolean).length;

  return (
    <div className="view-stack">
      <PageHeading
        eyebrow="Overview"
        title={pond.name}
        description="Live controller-owned pond state, active alerts, and actuator summary."
        trailing={<StatusBadge label={titleCase(pond.status)} tone={pond.status} />}
      />

      <DemoScenarioControls selectedScenario={selectedScenario} onScenarioChange={onScenarioChange} />

      <section className="summary-grid summary-grid--overview" aria-label="Overview summary">
        <SummaryCard label="Connection" value={pond.connected ? "Connected" : "Disconnected"} tone={pond.connected ? "normal" : "offline"} helper={`Last seen ${formatTimestamp(pond.lastSeenMs)}`} />
        <SummaryCard label="Pond status" value={titleCase(pond.status)} tone={pond.status} />
        <SummaryCard label="Operating mode" value={titleCase(settingsMode)} tone="info" />
        <SummaryCard label="Active alerts" value={String(activeAlerts.length)} tone={activeAlerts.some((alert) => alert.value.severity === "critical") ? "critical" : activeAlerts.length > 0 ? "warning" : "normal"} />
        <SummaryCard label="Actuators" value={`${runningDevices} running`} tone={runningDevices > 0 ? "info" : "normal"} helper={summarizeActuators(pond)} />
      </section>

      {!pond.connected && (
        <StatePanel title="Controller disconnected" description="The dashboard is showing the most recent reported pond state." tone="offline" />
      )}

      <div className="overview-grid">
        <section className="panel pond-panel" aria-labelledby="pond-visual-title">
          <div className="panel-heading panel-heading--bordered">
            <div>
              <span className="eyebrow">Pond visualization</span>
              <h2 id="pond-visual-title">Realtime water and device state</h2>
            </div>
          </div>
          <PondVisualization pond={pond} />
        </section>
        <ActiveAlertsPanel alerts={alerts} />
      </div>
    </div>
  );
}

function RealtimeView({
  pond,
  settings,
  alerts,
  telemetry,
}: {
  pond: PondState;
  settings: PondSettings | null;
  alerts: Array<KeyedRecord<PondAlert>>;
  telemetry: Array<KeyedRecord<TelemetryRecord>>;
}) {
  const metrics = useMemo(
    () => createMetricViewModels(pond.sensors, settings, alerts, telemetry),
    [alerts, pond.sensors, settings, telemetry],
  );

  return (
    <div className="view-stack">
      <PageHeading
        eyebrow="Realtime monitoring"
        title="Water quality sensors"
        description="Six hardware inputs are displayed separately from the salinity value derived from EC."
      />
      <div className="metric-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </div>
    </div>
  );
}

function DemoScenarioControls({
  selectedScenario,
  onScenarioChange,
}: {
  selectedScenario: DemoScenario;
  onScenarioChange(scenario: DemoScenario): void;
}) {
  return (
    <section className="demo-scenario-panel" aria-label="Demo scenario controls">
      <span className="eyebrow">Demo control</span>
      <div className="scenario-buttons">
        {DEMO_SCENARIOS.map((scenario) => (
          <button
            key={scenario.key}
            className={scenario.key === selectedScenario ? "scenario-button scenario-button--active" : "scenario-button"}
            type="button"
            onClick={() => onScenarioChange(scenario.key)}
          >
            {scenario.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function PondIdentity({ name }: { name: string }) {
  return (
    <div className="pond-identity">
      <span className="eyebrow">Current pond</span>
      <strong>{name}</strong>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "normal" | "info" | "offline" }) {
  return (
    <span className={`status-pill status-pill--${tone}`}>
      <Circle aria-hidden="true" />
      {label}
    </span>
  );
}

function PageHeading({ eyebrow, title, description, trailing }: { eyebrow: string; title: string; description: string; trailing?: ReactNode }) {
  return (
    <div className="page-heading page-heading--with-trailing">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {trailing && <div>{trailing}</div>}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  helper,
}: {
  label: string;
  value: string;
  tone: "normal" | "warning" | "critical" | "info" | "offline";
  helper?: string;
}) {
  return (
    <article className={`summary-card summary-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper && <small>{helper}</small>}
    </article>
  );
}

function StatePanel({ title, description, tone }: { title: string; description: string; tone: "info" | "warning" | "critical" | "offline" }) {
  return (
    <div className={`state-panel state-panel--${tone}`} role={tone === "critical" ? "alert" : "status"}>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function summarizeActuators(pond: PondState): string {
  const labels: Record<CommandDevice, string> = {
    aerator: "aerator",
    drainagePump: "drainage",
    dilutionPump: "intake",
    feeder: "feeder",
    buzzer: "buzzer",
    warningBeacon: "beacon",
  };
  const activeDevices = (Object.keys(pond.devices) as CommandDevice[]).filter((device) => pond.devices[device]);
  return activeDevices.length === 0 ? "All inactive" : activeDevices.map((device) => labels[device]).join(", ");
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

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

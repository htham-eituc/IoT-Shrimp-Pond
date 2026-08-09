import { useMemo, useState, type ComponentType, type SVGProps } from "react";
import {
  Activity,
  Bell,
  BellRing,
  CheckCircle2,
  CloudRain,
  Droplets,
  Fan,
  Gauge,
  History,
  LayoutDashboard,
  Lightbulb,
  LoaderCircle,
  LogOut,
  PanelTop,
  Power,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Thermometer,
  TriangleAlert,
  Upload,
  UserRound,
  Utensils,
  Waves,
  Zap,
} from "lucide-react";
import { ActiveAlerts } from "./components/ActiveAlerts";
import { DeviceControlCard } from "./components/DeviceControlCard";
import { MetricCard } from "./components/MetricCard";
import { PondScene } from "./components/PondScene";
import { StatusBadge } from "./components/StatusBadge";
import { getPondDataSource } from "./data";
import type {
  AlertRecord,
  CommandRecord,
  DeviceName,
  EventRecord,
  PondSensors,
  PondState,
  TelemetryRecord,
} from "./domain";
import { usePondDashboard } from "./hooks/usePondDashboard";
import {
  getSensorRangeLabel,
  getSensorTone,
  type SensorKey,
} from "./presentation/sensorStatus";

type DashboardView = "overview" | "monitoring" | "equipment";
type LucideIcon = ComponentType<SVGProps<SVGSVGElement>>;

const sourceResult = createSourceResult();
const isMockSource =
  (import.meta.env.VITE_POND_DATA_SOURCE as string | undefined)?.toLowerCase() !==
  "firebase";

const navigation: ReadonlyArray<{
  key: DashboardView;
  label: string;
  helper: string;
  icon: LucideIcon;
}> = [
  { key: "overview", label: "Overview", helper: "status, alerts, pond", icon: LayoutDashboard },
  { key: "monitoring", label: "Live monitoring", helper: "sensors & recent trends", icon: Activity },
  { key: "equipment", label: "Remote control", helper: "commands & feedback", icon: SlidersHorizontal },
];

const metricDefinitions: ReadonlyArray<{
  key: SensorKey;
  label: string;
  unit?: string;
  decimals: number;
  icon: LucideIcon;
}> = [
  { key: "ph", label: "Water pH", decimals: 1, icon: Gauge },
  { key: "do", label: "Dissolved oxygen", unit: "mg/L", decimals: 1, icon: Droplets },
  { key: "temperature", label: "Water temperature", unit: "°C", decimals: 1, icon: Thermometer },
  { key: "waterLevel", label: "Water level", unit: "%", decimals: 0, icon: Waves },
  { key: "rain", label: "Rain detection", decimals: 0, icon: CloudRain },
  { key: "ec", label: "Electrical conductivity", decimals: 1, icon: Zap },
  { key: "salinity", label: "Estimated salinity", unit: "ppt", decimals: 1, icon: Activity },
];

const deviceDefinitions: ReadonlyArray<{
  key: DeviceName;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { key: "aerator", label: "Paddlewheel aerator", description: "Raises dissolved oxygen and improves circulation.", icon: Fan },
  { key: "drainagePump", label: "Drainage pump", description: "Removes excess surface water during overflow risk.", icon: Upload },
  { key: "dilutionPump", label: "Dilution intake pump", description: "Adds settling-pond water to reduce salinity.", icon: Droplets },
  { key: "feeder", label: "Automatic feeder", description: "Feeds on schedule when pond conditions permit.", icon: Utensils },
  { key: "buzzer", label: "Local buzzer", description: "Provides an audible warning at the controller.", icon: Bell },
  { key: "warningBeacon", label: "Warning beacon", description: "Shows a highly visible local emergency signal.", icon: Lightbulb },
];

export default function App() {
  if (sourceResult.error) {
    return <ConfigurationError error={sourceResult.error} />;
  }

  return <DashboardApplication />;
}

function DashboardApplication() {
  const dataSource = sourceResult.dataSource!;

  const { state, signIn, signOut, sendCommand, saveSettings, refreshTelemetry } =
    usePondDashboard(dataSource);

  if (!state.authReady) {
    return <LoadingScreen label="Checking dashboard session…" />;
  }

  if (!state.session) {
    return <LoginScreen onSignIn={signIn} error={state.error} loading={state.loading} />;
  }

  if (state.loading && !state.pond) {
    return <LoadingScreen label="Connecting to pond data…" />;
  }

  if (!state.pond) {
    return (
      <EmptyState
        title="Pond state is unavailable"
        message={state.error ?? "No state exists at the pond path assigned to this account."}
        onSignOut={isMockSource ? undefined : signOut}
      />
    );
  }

  return (
    <Dashboard
      pond={state.pond}
      settings={state.settings}
      alerts={state.alerts}
      events={state.events}
      commands={state.commands}
      telemetry={state.telemetry}
      displayName={state.session.profile.displayName ?? state.session.email ?? "Pond operator"}
      pondId={state.session.profile.pondId}
      error={state.error}
      onCommand={sendCommand}
      onModeChange={async () => {
        if (!state.settings) return;
        await saveSettings({
          ...state.settings,
          mode: state.settings.mode === "automatic" ? "manual" : "automatic",
        });
      }}
      onRefreshTelemetry={refreshTelemetry}
      onSignOut={isMockSource ? undefined : signOut}
    />
  );
}

interface DashboardProps {
  pond: PondState;
  settings: ReturnType<typeof usePondDashboard>["state"]["settings"];
  alerts: readonly AlertRecord[];
  events: readonly EventRecord[];
  commands: readonly CommandRecord[];
  telemetry: readonly TelemetryRecord[];
  displayName: string;
  pondId: string;
  error: string | null;
  onCommand: ReturnType<typeof usePondDashboard>["sendCommand"];
  onModeChange: () => Promise<void>;
  onRefreshTelemetry: () => Promise<void>;
  onSignOut?: () => Promise<void>;
}

function Dashboard({
  pond,
  settings,
  alerts,
  events,
  commands,
  telemetry,
  displayName,
  pondId,
  error,
  onCommand,
  onModeChange,
  onRefreshTelemetry,
  onSignOut,
}: DashboardProps) {
  const [view, setView] = useState<DashboardView>("overview");
  const [modeChanging, setModeChanging] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);
  const pendingDevices = useMemo(
    () => new Set(commands.filter((command) => command.status === "pending").map((command) => command.device)),
    [commands],
  );
  const latestCommands = useMemo(() => latestCommandByDevice(commands), [commands]);

  async function changeMode() {
    setModeChanging(true);
    setModeError(null);
    try {
      await onModeChange();
    } catch (reason) {
      setModeError(reason instanceof Error ? reason.message : "Mode change failed.");
    } finally {
      setModeChanging(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">🦐</span>
          <div>
            <span className="brand-name">Smart Shrimp Pond</span>
            <span className="brand-subtitle">Aquaculture operations console</span>
          </div>
        </div>

        <div className="topbar__context">
          {isMockSource && <span className="source-badge">Mock RTDB</span>}
          <StatusBadge
            label={pond.connected ? "Controller online" : "Controller offline"}
            tone={pond.connected ? "normal" : "offline"}
            compact
          />
          <div className="operator-chip">
            <span><UserRound aria-hidden="true" /></span>
            <div>
              <strong>{displayName}</strong>
              <small>{pondId}</small>
            </div>
          </div>
          {onSignOut && (
            <button className="icon-button" type="button" onClick={() => void onSignOut()} aria-label="Sign out">
              <LogOut aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <nav className="view-tabs" aria-label="Dashboard views">
        <div className="view-tabs__inner">
          {navigation.map(({ key, label, helper, icon: Icon }) => (
            <button
              type="button"
              key={key}
              className={view === key ? "view-tab view-tab--active" : "view-tab"}
              aria-current={view === key ? "page" : undefined}
              onClick={() => setView(key)}
            >
              <Icon aria-hidden="true" />
              <span><strong>{label}</strong><small>{helper}</small></span>
            </button>
          ))}
        </div>
      </nav>

      <main className="dashboard-main">
        {error && <InlineError message={error} />}
        {modeError && <InlineError message={modeError} />}
        {view === "overview" && (
          <OverviewView
            pond={pond}
            settings={settings}
            alerts={alerts}
            events={events}
            pendingDevices={pendingDevices}
            modeChanging={modeChanging}
            onModeChange={() => void changeMode()}
          />
        )}
        {view === "monitoring" && (
          <MonitoringView
            pond={pond}
            settings={settings}
            alerts={alerts}
            telemetry={telemetry}
            onRefresh={() => void onRefreshTelemetry()}
          />
        )}
        {view === "equipment" && (
          <EquipmentView
            pond={pond}
            settings={settings}
            commands={latestCommands}
            onCommand={onCommand}
          />
        )}
      </main>

      <footer className="app-footer">
        <span>Smart Shrimp Pond · {isMockSource ? "Firebase-shaped demonstration data" : "Firebase Realtime Database"}</span>
        <span>Actual pond state is controller-owned</span>
      </footer>
    </div>
  );
}

interface OverviewViewProps {
  pond: PondState;
  settings: DashboardProps["settings"];
  alerts: readonly AlertRecord[];
  events: readonly EventRecord[];
  pendingDevices: ReadonlySet<DeviceName>;
  modeChanging: boolean;
  onModeChange: () => void;
}

function OverviewView({
  pond,
  settings,
  alerts,
  events,
  pendingDevices,
  modeChanging,
  onModeChange,
}: OverviewViewProps) {
  const activeAlerts = alerts.filter((alert) => alert.status === "active");
  const runningDevices = Object.values(pond.devices).filter(Boolean).length;

  return (
    <div className="view-stack view-enter">
      <PageHeading
        eyebrow="Operations overview"
        title={pond.name}
        description="Controller-reported status, active workflows, and confirmed equipment feedback."
        trailing={<StatusBadge label={titleCase(pond.status)} tone={pond.status} />}
      />

      <section className="status-strip" aria-label="Pond status summary">
        <StatusChip icon={Activity} label="Pond condition" value={titleCase(pond.status)} tone={pond.status} />
        <StatusChip icon={Power} label="Connection" value={pond.connected ? "Online" : "Offline"} tone={pond.connected ? "normal" : "offline"} helper={`Seen ${formatTimestamp(pond.lastSeenMs)}`} />
        <StatusChip icon={Settings2} label="Operating mode" value={settings ? titleCase(settings.mode) : "Unavailable"} tone="info" action={settings ? { label: modeChanging ? "Updating…" : `Switch to ${settings.mode === "automatic" ? "manual" : "automatic"}`, onClick: onModeChange, disabled: modeChanging } : undefined} />
        <StatusChip icon={BellRing} label="Active alerts" value={activeAlerts.length === 0 ? "None" : String(activeAlerts.length)} tone={activeAlerts.some((alert) => alert.severity === "critical") ? "critical" : activeAlerts.length ? "warning" : "normal"} />
        <StatusChip icon={Fan} label="Devices running" value={`${runningDevices} of 6`} tone="info" />
      </section>

      <div className="overview-grid">
        <section className="panel pond-panel" aria-labelledby="pond-view-title">
          <div className="panel-heading panel-heading--bordered">
            <div>
              <span className="eyebrow">Live pond cross-section</span>
              <h2 id="pond-view-title">Water & equipment state</h2>
            </div>
            <span className="last-update">Last feedback {formatTimestamp(pond.lastSeenMs)}</span>
          </div>
          <PondScene
            pond={pond}
            pendingDevices={pendingDevices}
            probeTones={{
              do: getSensorTone("do", pond.sensors, settings, alerts),
              ph: getSensorTone("ph", pond.sensors, settings, alerts),
              temperature: getSensorTone("temperature", pond.sensors, settings, alerts),
            }}
          />
        </section>
        <ActiveAlerts alerts={alerts} />
      </div>

      <section className="panel activity-panel" aria-labelledby="recent-activity-title">
        <div className="panel-heading panel-heading--bordered">
          <div><span className="eyebrow">Controller log</span><h2 id="recent-activity-title">Recent activity</h2></div>
          <History aria-hidden="true" />
        </div>
        <RecentEvents events={events.slice(0, 4)} />
      </section>
    </div>
  );
}

interface MonitoringViewProps {
  pond: PondState;
  settings: DashboardProps["settings"];
  alerts: readonly AlertRecord[];
  telemetry: readonly TelemetryRecord[];
  onRefresh: () => void;
}

function MonitoringView({ pond, settings, alerts, telemetry, onRefresh }: MonitoringViewProps) {
  return (
    <div className="view-stack view-enter">
      <PageHeading
        eyebrow="Realtime monitoring"
        title="Water quality at a glance"
        description="Seven live fields use the exact Realtime Database sensor contract."
        trailing={<button className="secondary-button" type="button" onClick={onRefresh}><RefreshCw aria-hidden="true" />Refresh history</button>}
      />
      <div className="metric-grid">
        {metricDefinitions.map(({ key, label, unit, decimals, icon: Icon }) => {
          const rawValue = pond.sensors[key];
          const value = typeof rawValue === "boolean" ? (rawValue ? "Detected" : "Clear") : rawValue.toFixed(decimals);
          return (
            <MetricCard
              key={key}
              icon={<Icon />}
              label={label}
              value={value}
              unit={typeof rawValue === "number" ? unit : undefined}
              rangeLabel={getSensorRangeLabel(key, settings)}
              tone={getSensorTone(key, pond.sensors, settings, alerts)}
              history={telemetry.map((sample) => sensorAsNumber(sample, key))}
            />
          );
        })}
      </div>
      <section className="monitoring-note">
        <PanelTop aria-hidden="true" />
        <div><strong>Latest device sample</strong><span>{formatTimestamp(pond.lastSeenMs)} · status is published by the pond controller</span></div>
      </section>
    </div>
  );
}

interface EquipmentViewProps {
  pond: PondState;
  settings: DashboardProps["settings"];
  commands: Partial<Record<DeviceName, CommandRecord>>;
  onCommand: DashboardProps["onCommand"];
}

function EquipmentView({ pond, settings, commands, onCommand }: EquipmentViewProps) {
  return (
    <div className="view-stack view-enter">
      <PageHeading
        eyebrow="Command center"
        title="Remote device control"
        description="Every action creates a pending command. Cards continue to show confirmed controller state."
        trailing={<StatusBadge label={`${settings ? titleCase(settings.mode) : "Mode unavailable"}`} tone="info" />}
      />
      {!pond.connected && (
        <div className="mode-banner mode-banner--offline"><TriangleAlert aria-hidden="true" /><div><strong>Controller is offline</strong><span>New actions are disabled because device feedback cannot currently be confirmed.</span></div></div>
      )}
      {settings?.mode === "automatic" && (
        <div className="mode-banner"><Settings2 aria-hidden="true" /><div><strong>Automatic workflows are enabled</strong><span>Manual requests remain commands; the device may apply its automatic safety logic.</span></div></div>
      )}
      <div className="device-grid">
        {deviceDefinitions.map(({ key, label, description, icon: Icon }) => (
          <DeviceControlCard
            key={key}
            device={key}
            name={label}
            description={description}
            icon={<Icon />}
            confirmedOn={pond.devices[key]}
            latestCommand={commands[key]}
            referenceTimeMs={pond.lastSeenMs}
            disabled={!pond.connected}
            onRequest={onCommand}
          />
        ))}
      </div>
      <p className="command-contract-note"><CheckCircle2 aria-hidden="true" />The web layer never writes actual actuator values. Only the pond controller updates confirmed device state.</p>
    </div>
  );
}

interface StatusChipProps {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "normal" | "warning" | "critical" | "info" | "offline";
  helper?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
}

function StatusChip({ icon: Icon, label, value, tone, helper, action }: StatusChipProps) {
  return (
    <article className={`status-chip status-chip--${tone}`}>
      <span className="status-chip__icon"><Icon aria-hidden="true" /></span>
      <div className="status-chip__content"><span>{label}</span><strong>{value}</strong>{helper && <small>{helper}</small>}</div>
      {action && <button type="button" onClick={action.onClick} disabled={action.disabled}>{action.label}</button>}
    </article>
  );
}

function PageHeading({ eyebrow, title, description, trailing }: { eyebrow: string; title: string; description: string; trailing?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {trailing && <div className="page-heading__trailing">{trailing}</div>}
    </div>
  );
}

function RecentEvents({ events }: { events: readonly EventRecord[] }) {
  if (events.length === 0) return <div className="healthy-empty"><CheckCircle2 aria-hidden="true" /><div><strong>No recent events</strong><p>Controller activity will appear here.</p></div></div>;
  return (
    <ol className="event-list">
      {events.map((event) => (
        <li key={event.id}>
          <span className="event-list__marker"><Activity aria-hidden="true" /></span>
          <div><strong>{describeEvent(event)}</strong><span>{event.reason ? humanize(event.reason) : humanize(event.type)}</span></div>
          <time dateTime={new Date(event.createdAtMs).toISOString()}>{formatTimestamp(event.createdAtMs)}</time>
        </li>
      ))}
    </ol>
  );
}

function LoginScreen({ onSignIn, error, loading }: { onSignIn: (email: string, password: string) => Promise<unknown>; error: string | null; loading: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onSignIn(email, password);
      setPassword("");
    } catch {
      // The shared data hook exposes the safe error message.
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-card__brand"><span className="brand-mark" aria-hidden="true">🦐</span><div><strong>Smart Shrimp Pond</strong><span>Secure farmer dashboard</span></div></div>
        <div className="auth-card__copy"><span className="eyebrow">Firebase Authentication</span><h1>Welcome back</h1><p>Sign in with the farmer account assigned to your pond.</p></div>
        <form onSubmit={(event) => void submit(event)}>
          <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="farmer@example.com" /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <InlineError message={error} />}
          <button className="primary-button" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" aria-hidden="true" /> : <Power aria-hidden="true" />}{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="auth-card__security"><CheckCircle2 aria-hidden="true" />Credentials are handled by Firebase Authentication and are never stored in RTDB.</p>
      </section>
    </main>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return <main className="loading-screen"><div className="loading-mark"><span>🦐</span><LoaderCircle className="spin" aria-hidden="true" /></div><strong>{label}</strong><p>Preparing the operations console</p></main>;
}

function ConfigurationError({ error }: { error: Error }) {
  return <EmptyState title="Dashboard configuration error" message={error.message} />;
}

function EmptyState({ title, message, onSignOut }: { title: string; message: string; onSignOut?: () => Promise<void> }) {
  return <main className="empty-page"><section className="empty-card"><TriangleAlert aria-hidden="true" /><h1>{title}</h1><p>{message}</p>{onSignOut && <button className="secondary-button" type="button" onClick={() => void onSignOut()}><LogOut aria-hidden="true" />Sign out</button>}</section></main>;
}

function InlineError({ message }: { message: string }) {
  return <div className="inline-error" role="alert"><TriangleAlert aria-hidden="true" />{message}</div>;
}

function createSourceResult(): { dataSource?: ReturnType<typeof getPondDataSource>; error?: Error } {
  try {
    return { dataSource: getPondDataSource() };
  } catch (reason) {
    return { error: reason instanceof Error ? reason : new Error("Could not configure the pond data source.") };
  }
}

function latestCommandByDevice(commands: readonly CommandRecord[]): Partial<Record<DeviceName, CommandRecord>> {
  const latest: Partial<Record<DeviceName, CommandRecord>> = {};
  for (const command of commands) latest[command.device] ??= command;
  return latest;
}

function sensorAsNumber(sample: PondSensors, key: SensorKey): number {
  const value = sample[key];
  return typeof value === "boolean" ? Number(value) : value;
}

function formatTimestamp(timestampMs: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(timestampMs);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

function describeEvent(event: EventRecord): string {
  if (event.type === "device_action") return `${titleCase(event.device)} turned ${event.action}`;
  return titleCase(event.type);
}

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Circle, LoaderCircle, LogOut, Waves } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DashboardSession } from "../domain/session";
import type { KeyedRecord, PondAlert, PondSettings, PondState, TelemetryRecord } from "../domain";
import type { DemoScenario, PondDataSource } from "../data";
import { isDemoScenarioSource } from "../data";
import { usePondDashboard } from "../hooks/usePondDashboard";
import { useLocaleFormatters } from "../i18n/formatters";
import { createMetricViewModels } from "../presentation/metrics";
import { getConnectionPresentation } from "../presentation/connection";
import { AlertsEventsView } from "./AlertsEventsView";
import { CommandCenterView, type DetailView } from "./CommandCenterView";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { DetailDrawer } from "./DetailDrawer";
import { DeviceControlPanel } from "./DeviceControlPanel";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MetricCard } from "./MetricCard";
import { SettingsView } from "./SettingsView";
import { TelemetryHistoryView } from "./TelemetryHistoryView";
import { UserMenu } from "./UserMenu";

interface AppShellProps {
  dataSource: PondDataSource;
  session: DashboardSession;
  showWelcome: boolean;
  onLogout(): Promise<void>;
}

export function AppShell({ dataSource, session, showWelcome, onLogout }: AppShellProps) {
  const { t } = useTranslation(["common", "dashboard", "auth"]);
  const formatters = useLocaleFormatters();
  const [detailView, setDetailView] = useState<DetailView | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario>("normal");
  const [welcomeVisible, setWelcomeVisible] = useState(showWelcome);
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const dashboard = usePondDashboard(dataSource, session.user.pondId);
  const currentTimeMs = useCurrentTimeMs();
  const demoScenariosEnabled = isDemoScenarioSource(dataSource);
  const closeDetail = useCallback(() => {
    setDetailView(null);
    setSettingsDirty(false);
  }, []);
  const openDetail = useCallback((view: DetailView) => {
    if (view !== "settings") setSettingsDirty(false);
    setDetailView(view);
  }, []);

  useEffect(() => {
    if (!welcomeVisible) return;
    const timer = window.setTimeout(() => setWelcomeVisible(false), 4_500);
    return () => window.clearTimeout(timer);
  }, [welcomeVisible]);

  function confirmLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setDetailView(null);
    setSettingsDirty(false);
    void onLogout();
  }

  function selectScenario(scenario: DemoScenario) {
    setSelectedScenario(scenario);
    if (isDemoScenarioSource(dataSource)) dataSource.setDemoScenario(session.user.pondId, scenario);
  }

  const pondName = dashboard.pond?.name ?? session.pond.name;
  const connected = dashboard.pond?.connected ?? session.pond.connected;
  const lastSeenMs = dashboard.pond?.lastSeenMs ?? null;
  const connection = getConnectionPresentation(connected, lastSeenMs ?? 0, currentTimeMs);
  const mode = dashboard.settings?.mode ?? session.pond.mode;
  const lastSeenText = lastSeenMs === null
    ? t("unavailable", { ns: "common" })
    : currentTimeMs === null
      ? formatters.timestamp(lastSeenMs)
      : formatters.relativeTime(lastSeenMs, currentTimeMs);

  return (
    <div className="app-shell app-shell--command-center">
      <header className="topbar topbar--command-center">
        <a className="brand-lockup" href="#main-content" aria-label={t("productAriaLabel", { ns: "common" })}>
          <span className="brand-mark" aria-hidden="true"><Waves /></span>
          <span>
            <strong>{t("brand", { ns: "common" })}</strong>
            <small>{t("subtitle", { ns: "common" })}</small>
          </span>
        </a>

        <div className="topbar-context topbar-context--command-center" aria-label={t("currentPondContext", { ns: "dashboard" })}>
          <PondIdentity name={pondName} />
          <StatusPill
            label={dashboard.pond ? t(`status.${dashboard.pond.status}`, { ns: "common" }) : t("unavailable", { ns: "common" })}
            tone={dashboard.pond?.status ?? "offline"}
          />
          <StatusPill
            label={t(`connection.${connection.state}`, { ns: "common" })}
            helper={t("lastSeenHeader", { ns: "dashboard", time: lastSeenText })}
            tone={connection.tone}
          />
          <StatusPill label={t(`mode.${mode}`, { ns: "common" })} tone="info" />
          <LanguageSwitcher />
          <UserMenu
            displayName={session.user.displayName}
            pondId={session.user.pondId}
            onSignOutRequest={() => setLogoutConfirmationOpen(true)}
          />
        </div>
      </header>

      <main className="command-center-main" id="main-content">
        {welcomeVisible && (
          <div className="welcome-toast" role="status" aria-live="polite" aria-atomic="true">
            <CheckCircle2 aria-hidden="true" />
            <span>
              <strong>{t("welcomeTitle", { ns: "dashboard", displayName: session.user.displayName })}</strong>
              <small>{t("welcomeDescription", { ns: "dashboard" })}</small>
            </span>
          </div>
        )}
        <div className="command-center-stage">
          <DashboardContent
            dataSource={dataSource}
            pondId={session.user.pondId}
            selectedScenario={selectedScenario}
            demoScenariosEnabled={demoScenariosEnabled}
            onScenarioChange={selectScenario}
            onOpenDetail={openDetail}
            dashboard={dashboard}
            currentTimeMs={currentTimeMs}
          />
        </div>
      </main>

      {detailView && dashboard.pond && (
        <DetailDrawer
          title={t(`nav.${detailView}`, { ns: "dashboard" })}
          size={["history", "settings", "alerts"].includes(detailView) ? "wide" : "medium"}
          onClose={closeDetail}
        >
          <DetailContent
            view={detailView}
            dataSource={dataSource}
            pondId={session.user.pondId}
            dashboard={dashboard}
            onSettingsDirtyChange={setSettingsDirty}
          />
        </DetailDrawer>
      )}

      {logoutConfirmationOpen && (
        <ConfirmationDialog
          title={t("signOutTitle", { ns: "dashboard" })}
          description={`${t("signOutDescription", { ns: "dashboard" })}${settingsDirty ? ` ${t("unsavedChanges", { ns: "dashboard" })}` : ""}`}
          confirmLabel={loggingOut ? t("signingOut", { ns: "auth" }) : t("logout", { ns: "dashboard" })}
          busy={loggingOut}
          icon={<LogOut />}
          onConfirm={confirmLogout}
          onCancel={() => setLogoutConfirmationOpen(false)}
        />
      )}
    </div>
  );
}

function DashboardContent({
  dataSource,
  pondId,
  selectedScenario,
  demoScenariosEnabled,
  onScenarioChange,
  onOpenDetail,
  dashboard,
  currentTimeMs,
}: {
  dataSource: PondDataSource;
  pondId: string;
  selectedScenario: DemoScenario;
  demoScenariosEnabled: boolean;
  onScenarioChange(scenario: DemoScenario): void;
  onOpenDetail(view: DetailView): void;
  dashboard: ReturnType<typeof usePondDashboard>;
  currentTimeMs: number | null;
}) {
  const { t } = useTranslation(["common", "dashboard", "errors"]);

  if (dashboard.loading && !dashboard.pond) {
    return <StatePanel title={t("loadingPond", { ns: "dashboard" })} description={t("openingSubscriptions", { ns: "dashboard" })} tone="info" loading />;
  }
  if (dashboard.error) {
    return (
      <StatePanel
        title={t("firebaseUnavailable", { ns: "dashboard" })}
        description={t("firebaseUnavailableDescription", { ns: "dashboard", reason: t(dashboard.error, { ns: "errors" }) })}
        tone="critical"
        action={<button className="button button--primary" type="button" onClick={() => window.location.reload()}>{t("retry", { ns: "common" })}</button>}
      />
    );
  }
  if (!dashboard.pond) {
    return <StatePanel title={t("noPondData", { ns: "dashboard" })} description={t("noPondDescription", { ns: "dashboard" })} tone="warning" />;
  }

  const connection = getConnectionPresentation(dashboard.pond.connected, dashboard.pond.lastSeenMs, currentTimeMs);
  return (
    <CommandCenterView
      dataSource={dataSource}
      pondId={pondId}
      pond={dashboard.pond}
      settings={dashboard.settings}
      alerts={dashboard.alerts}
      commands={dashboard.commands}
      telemetry={dashboard.telemetry}
      connectionState={connection.state}
      selectedScenario={selectedScenario}
      demoScenariosEnabled={demoScenariosEnabled}
      onScenarioChange={onScenarioChange}
      onOpenDetail={onOpenDetail}
    />
  );
}

function DetailContent({
  view,
  dataSource,
  pondId,
  dashboard,
  onSettingsDirtyChange,
}: {
  view: DetailView;
  dataSource: PondDataSource;
  pondId: string;
  dashboard: ReturnType<typeof usePondDashboard>;
  onSettingsDirtyChange(dirty: boolean): void;
}) {
  const { t } = useTranslation("dashboard");
  const pond = dashboard.pond;
  if (!pond) return null;

  if (view === "realtime") {
    return <RealtimeView pond={pond} settings={dashboard.settings} alerts={dashboard.alerts} telemetry={dashboard.telemetry} />;
  }
  if (view === "history") return <TelemetryHistoryView records={dashboard.telemetry} loading={dashboard.loading} />;
  if (view === "alerts") return <AlertsEventsView alerts={dashboard.alerts} events={dashboard.events} />;

  if (!dashboard.settings) {
    return <StatePanel title={t("settingsUnavailable")} description={t(view === "control" ? "settingsRequiredForCommands" : "noSettingsDescription")} tone="warning" />;
  }
  if (view === "settings") return <SettingsView dataSource={dataSource} pondId={pondId} settings={dashboard.settings} onDirtyChange={onSettingsDirtyChange} />;
  return (
    <DeviceControlPanel
      dataSource={dataSource}
      pondId={pondId}
      connected={pond.connected}
      devices={pond.devices}
      settings={dashboard.settings}
      commands={dashboard.commands}
    />
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
  const { t, i18n } = useTranslation(["dashboard", "sensors"]);
  const metrics = useMemo(
    () => createMetricViewModels(pond.sensors, settings, alerts, telemetry, t, i18n.resolvedLanguage ?? i18n.language),
    [alerts, i18n.language, i18n.resolvedLanguage, pond.sensors, settings, t, telemetry],
  );

  return (
    <div className="view-stack">
      <PageHeading
        eyebrow={t("realtime.eyebrow", { ns: "dashboard" })}
        title={t("realtime.title", { ns: "dashboard" })}
        description={t("realtime.description", { ns: "dashboard" })}
      />
      <div className="metric-grid">
        {metrics.map((metric) => <MetricCard key={metric.key} metric={metric} />)}
      </div>
    </div>
  );
}

function PondIdentity({ name }: { name: string }) {
  const { t } = useTranslation("dashboard");
  return (
    <div className="pond-identity">
      <span className="eyebrow">{t("currentPond")}</span>
      <strong>{name}</strong>
    </div>
  );
}

function StatusPill({
  label,
  helper,
  tone,
}: {
  label: string;
  helper?: string;
  tone: "normal" | "warning" | "critical" | "info" | "offline";
}) {
  return (
    <span className={`status-pill status-pill--${tone}`}>
      <Circle aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        {helper && <small>{helper}</small>}
      </span>
    </span>
  );
}

function useCurrentTimeMs(): number | null {
  const [currentTimeMs, setCurrentTimeMs] = useState<number | null>(null);
  useEffect(() => {
    const updateClock = () => setCurrentTimeMs(Date.now());
    queueMicrotask(updateClock);
    const timer = window.setInterval(updateClock, 5_000);
    return () => window.clearInterval(timer);
  }, []);
  return currentTimeMs;
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

function StatePanel({ title, description, tone, action, loading = false }: { title: string; description: string; tone: "info" | "warning" | "critical" | "offline"; action?: ReactNode; loading?: boolean }) {
  return (
    <div className={`state-panel state-panel--${tone}`} role={tone === "critical" ? "alert" : "status"} aria-live={tone === "critical" ? "assertive" : "polite"} aria-busy={loading || undefined}>
      {loading && <LoaderCircle className="spin" aria-hidden="true" />}
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

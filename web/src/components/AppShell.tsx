import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, LoaderCircle, LogOut, Waves } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DashboardSession } from "../domain/session";
import type { KeyedRecord, PondAlert, PondSettings, PondState, TelemetryRecord } from "../domain";
import type { PondDataSource } from "../data";
import { usePondDashboard } from "../hooks/usePondDashboard";
import { createMetricViewModels } from "../presentation/metrics";
import { getConnectionPresentation } from "../presentation/connection";
import { AlertsEventsView } from "./AlertsEventsView";
import { CommandCenterView, type DetailView } from "./CommandCenterView";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { DetailDrawer } from "./DetailDrawer";
import { DeviceControlPanel } from "./DeviceControlPanel";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { GmailAlertNotifier } from "./GmailAlertNotifier";
import { MetricCard } from "./MetricCard";
import { SettingsView } from "./SettingsView";
import { TelemetryHistoryView } from "./TelemetryHistoryView";
import { UserMenu } from "./UserMenu";
import type { Theme } from "../theme";

interface AppShellProps {
  dataSource: PondDataSource;
  session: DashboardSession;
  showWelcome: boolean;
  onLogout(): Promise<void>;
  theme?: Theme;
  onThemeChange?(theme: Theme): void;
}

export function AppShell({ dataSource, session, showWelcome, onLogout, theme = "dark", onThemeChange = () => undefined }: AppShellProps) {
  const { t } = useTranslation(["common", "dashboard", "auth"]);
  const [detailView, setDetailView] = useState<DetailView | null>(null);
  const [welcomeVisible, setWelcomeVisible] = useState(showWelcome);
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const dashboard = usePondDashboard(dataSource, session.user.pondId);
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

  const pondName = dashboard.pond?.name ?? session.pond.name;

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

        <div className="topbar-context topbar-context--command-center">
          <GmailAlertNotifier
            alerts={dashboard.alerts}
            clientId={import.meta.env.VITE_GOOGLE_GMAIL_CLIENT_ID}
            pondId={session.user.pondId}
            pondName={pondName}
            recipientEmail={session.user.email}
            userId={session.user.uid}
          />
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
            onOpenDetail={openDetail}
            dashboard={dashboard}
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
            theme={theme}
            onThemeChange={onThemeChange}
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
  onOpenDetail,
  dashboard,
}: {
  dataSource: PondDataSource;
  pondId: string;
  onOpenDetail(view: DetailView): void;
  dashboard: ReturnType<typeof usePondDashboard>;
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

  const connection = getConnectionPresentation(dashboard.pond.connected);
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
  theme,
  onThemeChange,
}: {
  view: DetailView;
  dataSource: PondDataSource;
  pondId: string;
  dashboard: ReturnType<typeof usePondDashboard>;
  onSettingsDirtyChange(dirty: boolean): void;
  theme: Theme;
  onThemeChange(theme: Theme): void;
}) {
  const { t } = useTranslation("dashboard");
  const pond = dashboard.pond;
  if (!pond) return null;

  if (view === "realtime") {
    return <RealtimeView pond={pond} settings={dashboard.settings} alerts={dashboard.alerts} telemetry={dashboard.telemetry} />;
  }
  if (view === "history") return <TelemetryHistoryView records={dashboard.telemetry} loading={dashboard.loading} />;
  if (view === "alerts") return <AlertsEventsView dataSource={dataSource} pondId={pondId} alerts={dashboard.alerts} events={dashboard.events} />;

  if (!dashboard.settings) {
    return <StatePanel title={t("settingsUnavailable")} description={t(view === "control" ? "settingsRequiredForCommands" : "noSettingsDescription")} tone="warning" />;
  }
  if (view === "settings") return <SettingsView dataSource={dataSource} pondId={pondId} settings={dashboard.settings} onDirtyChange={onSettingsDirtyChange} theme={theme} onThemeChange={onThemeChange} />;
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

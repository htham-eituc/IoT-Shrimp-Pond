import { useRef, useState, type KeyboardEvent } from "react";
import {
  Activity,
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
import type { DashboardSession, PondShellState } from "../domain/session";

type NavKey = "overview" | "realtime" | "control" | "history" | "settings" | "alerts";

const NAV_ITEMS: ReadonlyArray<{ key: NavKey; label: string; icon: LucideIcon }> = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "realtime", label: "Realtime", icon: Gauge },
  { key: "control", label: "Control", icon: SlidersHorizontal },
  { key: "history", label: "History", icon: History },
  { key: "settings", label: "Settings / Thresholds", icon: Settings2 },
  { key: "alerts", label: "Alerts & Events", icon: BellRing },
];

interface AppShellProps {
  session: DashboardSession;
  onLogout(): void;
}

export function AppShell({ session, onLogout }: AppShellProps) {
  const [activeView, setActiveView] = useState<NavKey>("overview");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand-lockup" href="#main-content" aria-label="Smart Shrimp Pond dashboard">
          <span className="brand-mark" aria-hidden="true">
            <Waves />
          </span>
          <span>
            <strong>Smart Shrimp Pond</strong>
            <small>Aquaculture operations shell</small>
          </span>
        </a>

        <div className="topbar-context" aria-label="Current pond context">
          <PondIdentity pond={session.pond} />
          <StatusPill label={session.pond.connected ? "Online" : "Offline"} tone={session.pond.connected ? "normal" : "offline"} />
          <StatusPill label={titleCase(session.pond.mode)} tone="info" />
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
          <ViewContent activeView={activeView} label={activeItem.label} pond={session.pond} />
        </section>
      </main>
    </div>
  );
}

function PondIdentity({ pond }: { pond: PondShellState }) {
  return (
    <div className="pond-identity">
      <span className="eyebrow">Current pond</span>
      <strong>{pond.name}</strong>
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

function ViewContent({ activeView, label, pond }: { activeView: NavKey; label: string; pond: PondShellState }) {
  if (activeView === "overview") {
    return (
      <div className="overview-shell">
        <div className="page-heading">
          <span className="eyebrow">Dashboard foundation</span>
          <h1>{pond.name}</h1>
          <p>Mock farmer session, responsive shell, visual tokens, and navigation are ready for the next phase.</p>
        </div>

        <div className="summary-grid" aria-label="Pond shell summary">
          <SummaryCard label="Pond ID" value={pond.id} tone="info" />
          <SummaryCard label="Connection" value={pond.connected ? "Online" : "Offline"} tone={pond.connected ? "normal" : "offline"} />
          <SummaryCard label="Operating mode" value={titleCase(pond.mode)} tone="info" />
          <SummaryCard label="Data source" value="Mock auth only" tone="warning" />
        </div>
      </div>
    );
  }

  return (
    <div className="placeholder-view">
      <Activity aria-hidden="true" />
      <span className="eyebrow">{label}</span>
      <h1>{label}</h1>
      <p>This view is part of the shell and is waiting for its phase-specific implementation.</p>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "normal" | "warning" | "info" | "offline" }) {
  return (
    <article className={`summary-card summary-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

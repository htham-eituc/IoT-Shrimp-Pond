# Web Implementation Plan

Phase 0 scope: repository audit and migration plan only. Do not rewrite Firebase
rules, do not change IoT firmware, and do not continue UI migration until Phase 1
is explicitly approved.

## 1. Current Repository Audit

### Web directory

The current web directory is:

```text
web/
```

The tracked repository already contains a Vite-based web package, but the tracked
implementation is a minimal Firebase test page, not the production dashboard:

```text
web/index.html
web/js/auth.js
web/js/firebase.js
web/js/sensors.js
web/js/test.js
web/package.json
```

Tracked `web/package.json` uses Vite scripts and has Firebase as the only runtime
dependency. It does not contain React or TypeScript in the tracked baseline.

The current working tree also contains uncommitted React/Vite/TypeScript migration
artifacts:

```text
web/src/
web/vite.config.ts
web/tsconfig.json
web/eslint.config.js
```

Those uncommitted files should be treated as existing working-tree state, not as
Phase 0 output. Phase 1 should either continue from that state after approval or
first establish the intended baseline in a separate cleanup step.

### Current web architecture

Current tracked architecture:

```text
Vite static page
-> web/index.html
-> /js/test.js
-> Firebase JS modules under web/js/
-> direct Firebase auth/profile/live-sensor smoke test
```

This is useful as a connectivity test, but it is not a dashboard architecture. It
does not contain a typed data contract, reusable components, command lifecycle UI,
history views, alert history views, or a mock data source that mirrors Firebase
Realtime Database.

## 2. Legacy HTML Reference Audit

Reference file:

```text
shrimp-pond-dashboard.html
```

This file is a visual and interaction reference only. It is a self-contained
Vietnamese demo with inline CSS, inline SVG, canvas charts, local JavaScript state,
scenario buttons, and synthetic telemetry. It must not define the Firebase data
contract.

### Design tokens

Preserve these visual tokens in React/CSS:

| Token | Legacy value | Migration use |
|---|---:|---|
| Background | `#06202B` | App background |
| Panel | `#0D2E3B` | Main panels/cards |
| Panel alternate | `#123B4A` | Nested rows, alert items |
| Raised | `#163F4E` | Controls, selected states |
| Border | `rgba(255,255,255,0.08)` | Card and panel border |
| Soft border | `rgba(255,255,255,0.05)` | Subtle dividers |
| Normal/accent | `#2FBFA0` | Normal state, primary accent |
| Warning | `#E8A33D` | Warning/watch state |
| Critical | `#F2563B` | Critical/alert state |
| Info/weather | `#5FA8D3` | Informational and rain visuals |
| Primary text | `#EAF4F2` | Main text |
| Muted text | `#7FA3A6` | Secondary text |
| Faint text | `#4E7378` | Captions/meta |
| Radius | `14px` | Legacy card/panel radius |
| Display font | `Space Grotesk` | Brand/headings |
| Body font | `IBM Plex Sans` | UI text |
| Mono font | `IBM Plex Mono` | Readings/timestamps |

The visual language is dark, technical, aquatic, compact, and operational. It uses
fine borders, status-tinted fills, small icon tiles, large mono readings, and soft
pond-blue/teal atmosphere.

### Layout

Legacy layout:

```text
Sticky topbar
-> brand mark/name
-> scenario selector
-> automatic/manual toggle
-> clock/context

Scrollable tab bar

main max-width 1180px
-> one active section at a time
-> 28px page padding
-> grid-2, grid-3, grid-6 helpers
```

Responsive behavior:

```text
<= 900px: grids become 2 columns; pond/alerts stack
<= 560px: grids become 1 column
tabs scroll horizontally
header wraps
SVG scales fluidly
```

Phase 1 should keep the dense dashboard feel, but should improve mobile table
handling, semantic navigation, keyboard behavior, and reduced-motion support.

### Tabs/pages

Legacy tabs:

| Legacy tab key | Purpose | Phase 1 treatment |
|---|---|---|
| `overview` | Pond status, mode, active alerts, pond SVG | Implement first |
| `realtime` | Metric cards and sparklines | Implement first |
| `control` | Remote device controls | Implement first |
| `history` | Synthetic 24h charts | Defer or implement from `/telemetry/{pondId}` |
| `thresholds` | Local demo threshold sliders | Defer or implement from `/settings/{pondId}` |
| `alertlog` | Hard-coded alert table | Defer or implement from `/alerts` plus `/events` |

### Pond SVG visualization

The legacy SVG contains:

```text
pond bank and water body
water level rectangle and dashed level line
water percentage label
paddlewheel groups with speed classes
bubble animation
DO, pH, and temperature probes
rain overlay
sun overlay for heat scenario
moon overlay for night scenario
drainage pump marker and flow dash
dilution/intake pump marker and flow dash
acid surface layer for rain scenario
```

Firebase-safe bindings:

| SVG element | Bind to Firebase |
|---|---|
| Water fill and label | `/ponds/{pondId}/sensors/waterLevel` |
| Rain overlay | `/ponds/{pondId}/sensors/rain` boolean |
| Bubbles/paddle animation | confirmed `/ponds/{pondId}/devices/aerator` |
| Drain marker | confirmed `/ponds/{pondId}/devices/drainagePump` |
| Dilution marker | confirmed `/ponds/{pondId}/devices/dilutionPump` |
| Probe readings/colors | current sensors plus settings/alerts for display only |
| Status halo | device-owned `/ponds/{pondId}/status` |

Do not bind sun/moon/acid storytelling to synthetic scenarios. Use active alerts
or real sensor state if such decorations remain.

### Sensor cards

Legacy metrics:

```text
ph
do
temp
level
rain
ec
```

Each card has an icon tile, status pill, display name, large mono reading, unit,
sparkline canvas, and range caption.

Firebase metrics:

```text
ph
do
temperature
waterLevel
rain
ec
salinity
```

Phase 1 must render all seven Firebase sensor fields. `rain` is boolean, not a
rate. `ec` and `salinity` are separate values. Do not invent an EC unit if the
contract does not define one.

### Device controls

Legacy controls:

```text
paddle: off / low / high
pumpDrain: off / on
pumpIntake: off / on
feeder: off / suspended / scheduled
```

Legacy behavior mutates `manualOverride` locally and re-renders immediately. This
must not be migrated as production behavior.

Firebase controls:

```text
aerator: on/off command, confirmed boolean state
drainagePump: on/off command, confirmed boolean state
dilutionPump: on/off command, confirmed boolean state
feeder: on/off command, confirmed boolean state
buzzer: on/off command, confirmed boolean state
warningBeacon: on/off command, confirmed boolean state
```

Manual actions must create command objects under `/commands/{pondId}/{commandId}`
and wait for device feedback through `/ponds/{pondId}/devices`.

### History visualization

Legacy history uses hard-coded 24-hour arrays in `HIST_METRICS`:

```text
do
ph
temp
ec
```

It draws canvas line charts with a translucent fill, dashed threshold line, and
one event marker per chart. In the migration, history charts must read from
`/telemetry/{pondId}/{timestampMs}` and not from synthetic arrays.

### Threshold controls

Legacy local thresholds:

| Legacy key | Meaning |
|---|---|
| `doMin` | DO low threshold |
| `doRestore` | DO recovery threshold |
| `phMin` | pH acidification threshold |
| `tempMax` | Temperature high threshold |
| `ecMax` | EC/salinity high threshold |
| `rainTrigger` | Rain rate threshold in mm/h |

Firebase settings thresholds are different and more complete:

```text
thresholds.ph.normalMin
thresholds.ph.normalMax
thresholds.ph.warningLow
thresholds.ph.warningHigh

thresholds.do.normalMin
thresholds.do.hypoxia
thresholds.do.critical
thresholds.do.recovery
thresholds.do.triggerDurationSec

thresholds.temperature.normalMin
thresholds.temperature.normalMax
thresholds.temperature.warningLow
thresholds.temperature.warningHigh

thresholds.salinity.normalMin
thresholds.salinity.normalMax
thresholds.salinity.warningLow
thresholds.salinity.warningHigh

thresholds.waterLevel.normalMin
thresholds.waterLevel.normalMax
thresholds.waterLevel.warningLow
thresholds.waterLevel.warningHigh
thresholds.waterLevel.overflowTriggerDurationSec
```

Firebase also has:

```text
mode
automation.hypoxiaResponseEnabled
automation.rainOverflowResponseEnabled
automation.heatSalinityResponseEnabled
```

There is no Firebase `rainTrigger` mm/h setting and no EC threshold setting.

### Alert log

Legacy alert log is local and contains:

```text
time
type
action
status
level
```

It filters hard-coded Vietnamese alert names and displays a table with "system
action" text. Firebase alerts do not have a required `action` field. Actions
belong in `/events/{pondId}` when recorded.

Production alert history should:

```text
read `/alerts/{pondId}` for alert type, severity, status, message, measurements, timestamps
read `/events/{pondId}` for device actions and workflow events
avoid claiming email/CaCO3/manual intervention unless event data exists
```

### Scenario simulation logic

Legacy simulation:

```text
SCENARIOS.normal/rain/heat/night define target sensor values and fake actuator state
scenario buttons switch local scenario
stepLive runs every 2600 ms and drifts values toward targets with jitter
statusOf computes display severity from local `thresh`
setScenario injects local alert rows
mode switch mutates local `autoMode`
manual control buttons mutate `manualOverride`
history and alert logs are hard-coded
```

This may be useful only inside `MockPondDataSource` or a hidden developer harness.
The production UI must not depend on scenario names or mutate actual state.

## 3. Firebase Contract Mapping

Source of truth:

```text
docs/Database and Rules.md
firebase/database.rules.json
firebase/database-example.json
```

### `/users/{uid}`

Purpose: authorization metadata only.

Shape:

```ts
{
  role: "farmer" | "device";
  pondId: string;
  displayName?: string;
}
```

Access:

```text
authenticated user can read only `/users/{auth.uid}`
no client writes to `/users`
```

Dashboard use:

```text
after Firebase login, read `/users/{uid}`
require `role === "farmer"`
use `pondId` to subscribe to pond-scoped paths
```

### `/ponds/{pondId}`

Purpose: latest known pond state.

Shape:

```ts
{
  name: string;
  status: "normal" | "warning" | "critical";
  connected: boolean;
  lastSeenMs: number;
  sensors: {
    ph: number;
    do: number;
    temperature: number;
    waterLevel: number;
    rain: boolean;
    ec: number;
    salinity: number;
  };
  devices: {
    aerator: boolean;
    drainagePump: boolean;
    dilutionPump: boolean;
    feeder: boolean;
    buzzer: boolean;
    warningBeacon: boolean;
  };
}
```

Validation highlights:

```text
ph: 0..14
do: 0..30
temperature: 0..60
waterLevel: 0..100
rain: boolean
ec: >= 0
salinity: 0..60
devices: all booleans, closed child schema
status: normal/warning/critical
name: non-empty string, max 100 chars
```

Write ownership:

```text
farmer can write only pond name
device writes status, connected, lastSeenMs, sensors, devices
```

Dashboard rule:

```text
display actual values but never write sensors, devices, status, connected, or lastSeenMs
```

### `/settings/{pondId}`

Purpose: farmer-configurable settings read by the device.

Shape:

```ts
{
  mode: "automatic" | "manual";
  thresholds: {
    ph: {
      normalMin: number;
      normalMax: number;
      warningLow: number;
      warningHigh: number;
    };
    do: {
      normalMin: number;
      hypoxia: number;
      critical: number;
      recovery: number;
      triggerDurationSec: number;
    };
    temperature: {
      normalMin: number;
      normalMax: number;
      warningLow: number;
      warningHigh: number;
    };
    salinity: {
      normalMin: number;
      normalMax: number;
      warningLow: number;
      warningHigh: number;
    };
    waterLevel: {
      normalMin: number;
      normalMax: number;
      warningLow: number;
      warningHigh: number;
      overflowTriggerDurationSec: number;
    };
  };
  automation: {
    hypoxiaResponseEnabled: boolean;
    rainOverflowResponseEnabled: boolean;
    heatSalinityResponseEnabled: boolean;
  };
}
```

Access:

```text
matching farmer: read/write
matching device: read
rules currently validate `mode`, but do not fully validate nested threshold ranges
```

Dashboard rule:

```text
settings edits must preserve the exact nested schema
do not create convenience fields such as ecMax or rainTrigger
```

### `/commands/{pondId}/{commandId}`

Purpose: manual action requests from farmer UI to device.

Shape:

```ts
{
  device:
    | "aerator"
    | "drainagePump"
    | "dilutionPump"
    | "feeder"
    | "buzzer"
    | "warningBeacon";
  action: "on" | "off";
  source: "manual";
  createdAtMs: number;
  status: "pending" | "completed" | "failed";
  processedAtMs: number | null;
}
```

Lifecycle:

```text
web creates command with status pending and processedAtMs null
device observes command
device executes physical/logical action
device updates `/ponds/{pondId}/devices`
device sets command status completed or failed
```

Access:

```text
matching accounts can read
farmer can create a new command only
device can write command status and processedAtMs
```

Dashboard rule:

```text
buttons are commands, not optimistic switches
show confirmed state from `/ponds/{pondId}/devices`
show pending/failed/completed command feedback separately
wait for confirmed device feedback before showing final success
```

### `/telemetry/{pondId}/{timestampMs}`

Purpose: historical sensor measurements.

Shape:

```ts
{
  timestampMs: number;
  ph: number;
  do: number;
  temperature: number;
  waterLevel: number;
  rain: boolean;
  ec: number;
  salinity: number;
}
```

Access:

```text
matching accounts can read
device writes
```

Rule caveat:

```text
rules require expected children but do not duplicate every numeric range bound
```

Dashboard use:

```text
history charts and sparklines should query telemetry by timestamp
do not synthesize history in production Firebase mode
```

### `/alerts/{pondId}/{alertId}`

Purpose: active and historical environmental alerts owned by the device.

Typical shape:

```ts
{
  type: string;
  severity: string;
  status: string;
  message: string;
  measurements?: Record<string, unknown>;
  createdAtMs: number;
  resolvedAtMs: number | null;
}
```

Documented examples:

```text
hypoxia: severity critical, measurements { do }
rain_overflow: severity critical, measurements { rain, waterLevel, ph }
heat_salinity: severity warning, measurements { temperature, salinity }
```

Access:

```text
matching accounts can read
device writes
```

Dashboard rule:

```text
display alerts
never create or resolve alerts from the web layer
```

### `/events/{pondId}/{eventId}`

Purpose: device actions, workflow events, connection events, and farmer/device audit
events.

Typical shape:

```ts
{
  type:
    | "device_action"
    | "mode_change"
    | "threshold_change"
    | "connection"
    | "workflow_started"
    | "workflow_resolved"
    | string;
  source?: "automatic" | "manual" | string;
  device?: string;
  action?: string;
  reason?: string;
  createdAtMs: number;
}
```

Access:

```text
matching authenticated accounts can read and write events
```

Dashboard use:

```text
show event history
optionally append farmer audit events for settings/mode changes
do not use events to bypass command lifecycle or mutate device state
```

## 4. Protocol Inconsistencies to Resolve

| Legacy HTML model | Firebase contract | Migration decision |
|---|---|---|
| `temp` | `temperature` | Rename everywhere in UI/domain to `temperature` |
| `level` | `waterLevel` | Rename everywhere in UI/domain to `waterLevel` |
| `rain` numeric mm/h | `rain` boolean | Render as rain detected/not detected; no mm/h UI unless protocol changes |
| `ec` displayed as salinity in ppt | `ec` and `salinity` are separate | Show both; avoid claiming EC is salinity |
| 6 metric cards | 7 sensor fields | Add salinity card |
| `paddle` off/low/high | `aerator` boolean | Use on/off command only |
| `pumpDrain` | `drainagePump` | Rename to contract field |
| `pumpIntake` | `dilutionPump` | Rename to contract field |
| `feeder` off/suspended/scheduled | `feeder` boolean | Use on/off only; schedule state is not in contract |
| Missing buzzer/beacon controls | `buzzer`, `warningBeacon` | Add device command cards |
| Direct `manualOverride` mutation | `/commands/{pondId}/{commandId}` | Create command and wait for feedback |
| Local `autoMode` boolean | `/settings/{pondId}/mode` | Write settings only; display subscribed value |
| Local `statusOf` determines scenario severity | `/ponds/{pondId}/status` is device-owned | Use local severity only for display hints, never global state |
| Local alert rows with action text | `/alerts` and `/events` | Split alerts from action events |
| Email/CaCO3 claims | Not in Firebase contract | Do not display unless represented in events |
| `rainTrigger` threshold | No Firebase field | Do not add to settings |
| `ecMax` threshold | No Firebase EC threshold | Do not add to settings |
| pH minimum only | pH normal/warning low/high fields | Use exact nested pH settings |
| Water level warning uses hard-coded 95 | Water level settings include normal/warning high/low and overflow duration | Use settings fields |

## 5. Proposed React Component Structure

Phase 1 should migrate only the dashboard shell, realtime overview, sensor cards,
pond visualization, active alerts, and manual command controls. Full history,
threshold editing, and alert/event history can be added after the foundation is
stable.

Proposed structure:

```text
web/src/
  main.tsx
  App.tsx
  styles.css

  domain/
    pond.ts
    guards.ts
    index.ts

  data/
    PondDataSource.ts
    MockPondDataSource.ts
    FirebasePondDataSource.ts
    createPondDataSource.ts
    index.ts

  hooks/
    usePondDashboard.ts

  presentation/
    sensorStatus.ts
    formatters.ts

  components/
    AppShell.tsx
    AuthGate.tsx
    TopBar.tsx
    DashboardTabs.tsx
    StatusBadge.tsx
    ConnectionBadge.tsx
    StatusStrip.tsx
    PondScene.tsx
    MetricGrid.tsx
    MetricCard.tsx
    Sparkline.tsx
    ActiveAlertsPanel.tsx
    DeviceControlPanel.tsx
    DeviceCommandCard.tsx
    CommandStateBadge.tsx
    RecentEventsPanel.tsx
```

Suggested app hierarchy:

```text
App
-> AuthGate
-> AppShell
   -> TopBar
   -> DashboardTabs
   -> OverviewPage
      -> StatusStrip
      -> PondScene
      -> ActiveAlertsPanel
      -> RecentEventsPanel
   -> RealtimePage
      -> MetricGrid
      -> MetricCard
      -> Sparkline
   -> ControlPage
      -> ModeSummary
      -> DeviceControlPanel
      -> DeviceCommandCard
```

Status rules:

```text
global normal/warning/critical comes from `/ponds/{pondId}/status`
connection is separate from status
metric cards may display warning hints from settings/alerts
web never writes device-owned state
```

Accessibility rules:

```text
semantic landmarks and headings
real buttons for commands
visible focus states
status text plus icon plus color
aria-live for command transitions and critical alerts
reduced-motion support for pond animations
text alternatives for SVG/canvas visuals
```

## 6. Proposed Data Abstraction

The UI should consume one data-source interface. Mock and Firebase implementations
must return the same domain objects and path-shaped records.

```ts
type Unsubscribe = () => void;

interface PondDataSource {
  getCurrentSession(): FarmerSession | null;
  observeSession(
    listener: (session: FarmerSession | null) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;

  subscribePond(
    pondId: string,
    listener: (pond: PondState | null) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe;
  subscribeSettings(
    pondId: string,
    listener: (settings: PondSettings | null) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe;
  subscribeAlerts(
    pondId: string,
    listener: (alerts: Record<string, PondAlert>) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe;
  subscribeEvents(
    pondId: string,
    listener: (events: Record<string, PondEvent>) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe;
  subscribeCommands(
    pondId: string,
    listener: (commands: Record<string, PondCommand>) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe;

  loadTelemetry(
    pondId: string,
    options?: { limit?: number; startAtMs?: number; endAtMs?: number },
  ): Promise<Record<string, PondTelemetry>>;

  createManualCommand(
    pondId: string,
    request: { device: CommandDevice; action: CommandAction },
  ): Promise<string>;
  updateSettings(pondId: string, settings: PondSettings): Promise<void>;
  updatePondName(pondId: string, name: string): Promise<void>;
}
```

Implementation rules:

```text
MockPondDataSource stores one in-memory object shaped like Firebase RTDB
FirebasePondDataSource reads/writes exact RTDB paths
createPondDataSource selects mock or firebase by environment
default local mode should be mock
Firebase config comes only from Vite env variables
no real credentials are committed
```

Allowed web writes through the abstraction:

```text
create manual command
update full settings object
update pond name
optionally append farmer event, if intentionally modeled
```

Forbidden web writes through the abstraction:

```text
sensors
actual device booleans
pond status
connected
lastSeenMs
alerts
telemetry
device command completion fields
```

Manual command UI flow:

```text
read confirmed device state from `/ponds/{pondId}/devices`
user clicks Turn on/off
create command with status pending
show pending request without changing confirmed state
watch `/commands/{pondId}` and `/ponds/{pondId}/devices`
on command failed: show failure and leave confirmed state unchanged
on command completed: wait until confirmed device state matches requested action
then show success
```

## 7. Proposed Phase 1 File Changes

Phase 1 should be limited to the Vite React dashboard foundation. Expected files:

```text
README.md
web/.env.example
web/index.html
web/package.json
web/package-lock.json
web/tsconfig.json
web/vite.config.ts
web/eslint.config.js
web/src/main.tsx
web/src/App.tsx
web/src/styles.css
web/src/domain/*
web/src/data/*
web/src/hooks/*
web/src/presentation/*
web/src/components/*
```

Expected removals or replacements:

```text
web/js/auth.js
web/js/firebase.js
web/js/sensors.js
web/js/test.js
```

Do not change:

```text
firebase/database.rules.json
firebase/database-example.json
iot/*
```

Do not commit generated build output unless the repository explicitly wants it:

```text
web/dist/
```

## 8. Phase 1 Verification Plan

At the end of Phase 1, run from `web/`:

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

Additional checks:

```text
verify mock command lifecycle does not optimistically mutate device state
verify Firebase mode refuses to start without required env values
verify no source file contains real Firebase credentials
verify no UI path can write sensors, device booleans, status, connection, alerts, or telemetry
```

## 9. Summary

Current web architecture:

```text
tracked: minimal Vite static Firebase test page
working tree: uncommitted React/Vite/TypeScript migration artifacts already exist
```

Proposed web architecture:

```text
Vite + React + TypeScript
typed Firebase RTDB domain model
PondDataSource interface
MockPondDataSource and FirebasePondDataSource
componentized dashboard shell, realtime metrics, pond visualization, alerts, and command controls
```

Protocol inconsistencies:

```text
legacy `temp` -> Firebase `temperature`
legacy `level` -> Firebase `waterLevel`
legacy numeric rain mm/h -> Firebase boolean rain
legacy EC-as-salinity -> Firebase separate ec and salinity
legacy thresholds -> exact Firebase settings thresholds
legacy direct controls -> Firebase command lifecycle
legacy synthetic alerts/actions -> Firebase alerts plus events
```

Files changed in Phase 0:

```text
docs/web-implementation-plan.md
```

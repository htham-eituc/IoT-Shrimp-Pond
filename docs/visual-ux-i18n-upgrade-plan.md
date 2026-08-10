# Smart Shrimp Pond visual, UX, 3D, and localization upgrade plan

## 1. Purpose and constraints

This is a Phase 9 audit and migration plan. It does not change the application, Firebase contract, Firebase rules, or IoT firmware.

The existing domain model, `PondDataSource` implementations, authentication, scenario engine, telemetry, settings, alerts, events, and manual-command lifecycle remain authoritative. A future 3D scene must be a read-only projection of those existing values. It must not become another store, infer device truth, or mutate `PondState`.

Classification used throughout this document:

- **A — operational-critical:** a farmer should see it immediately while operating the pond.
- **B — useful secondary:** important context or analysis, but it may be one interaction away.
- **C — configuration/detail:** editing, audit metadata, developer controls, or low-frequency information.

### Audit scope

The audit covered the current React views and helpers in `web/src`, the responsive rules in `web/src/styles.css`, the design tokens in `web/src/design/tokens.css`, and the current SVG pond scene in `web/src/components/PondVisualization.tsx`.

The current application is a six-view dashboard with a sticky 74 px header, a second sticky navigation row, a centered 1180 px content column, and large independently scrolling views. Its information is complete, but operational state is fragmented: sensors are on Realtime, device commands are on Control, and active alerts plus the pond drawing are on Overview.

At 1366×768, the current layout cannot keep the primary operating picture in one viewport. The header and navigation consume approximately 136 px before main-content padding; Overview then adds a page heading, optional demo scenario controls, five 116 px summary cards, gaps, and a pond scene with a 330 px minimum height. This is a code-derived layout assessment, not a browser measurement.

## 2. Current information architecture

### 2.1 Global authenticated shell

| Visible item | Class | Audit note |
| --- | --- | --- |
| Product name and aquaculture subtitle | B | Useful orientation; can be more compact on the command-center screen. |
| Pond name and assigned pond identifier | A | The operator must know which pond is being viewed. The identifier can be visually subordinate to the name. |
| Connection state: Online, Stale, or Offline | A | Must remain independent from pond severity. |
| Last-seen time | A | Required to judge whether displayed values are current; show relative age with exact time available. |
| Operating mode | A | Determines whether manual controls are available and who owns actuator behavior. |
| Operator display name | B | Useful account context. |
| Logout | B | Must remain easy to find but does not need command-center area. |
| Six-view navigation | B | Current route/view selection; in the redesign, secondary destinations become drawers or dialogs. |

### 2.2 Overview

| Visible information | Class | Current presentation and recommendation |
| --- | --- | --- |
| Pond name | A | Page title; retain in the persistent header/status rail. |
| Overall `pond.status` | A | Normal, Warning, or Critical from the device; never recompute or write it in the web layer. |
| Connection state and last seen | A | Summary card plus disconnected/stale banners. Consolidate into one always-visible freshness control. |
| Operating mode | A | Summary card. Retain as an always-visible segmented status/control. |
| Active-alert count and severity | A | Summary plus alert panel. Show the most severe active alert and count without opening another view. |
| Active-alert messages and timestamps | A | Current compact feed. Keep active emergency alerts in the right rail; detailed metadata may move to the log drawer. |
| Number of running actuators | A | Useful at a glance, but named states are more actionable than only a count. |
| Names of active actuators | A | Currently a summary helper string. Replace with six compact state indicators. |
| Pond SVG: water level | A | Bound to `sensors.waterLevel`; retain in 3D and fallback. |
| Pond SVG: rain | A | Bound to boolean `sensors.rain`; retain without a rainfall-rate value. |
| Pond SVG: aerator and bubbles | A | Bound to confirmed `devices.aerator`; retain. |
| Pond SVG: drainage and dilution flows | A | Bound to confirmed pump booleans; retain. |
| Pond SVG: feeder state | A | Bound to confirmed `devices.feeder`; retain. |
| Pond SVG: buzzer/beacon/status warning marker | A | Retain with text/icon status outside the canvas so meaning is not color-only. |
| Pond SVG: DO, pH, and temperature probe markers | A | Readings are important. Existing fixed “active” thresholds should be replaced by the established settings/metric presentation logic rather than hardcoded SVG cutoffs. |
| Pond visualization legend | B | Useful orientation; compact it or expose it as accessible help. |
| Disconnected explanatory message | A | Keep, but avoid duplicating the persistent connection/freshness state. |
| Stale-heartbeat explanatory message | A | Keep as a prominent warning when age exceeds the current freshness rule. |
| Demo scenario selector | C | Mock/development-only. Move to a labelled developer drawer and never expose it in Firebase protocol or production mode. |
| Page eyebrow and descriptive copy | C | Helpful onboarding, but it consumes scarce vertical space and can move to help text. |

### 2.3 Realtime

| Visible information | Class | Current presentation and recommendation |
| --- | --- | --- |
| pH value, unit/state | A | Always show in the compact sensor rail. |
| Dissolved oxygen value, unit/state | A | Highest-priority water-quality metric; emphasize critical/hypoxia state. |
| Temperature value, unit/state | A | Always show. |
| Water-level value, unit/state | A | Always show and bind to visual water height. |
| Boolean rain state | A | Always show as “Rain/No rain” or the Vietnamese equivalent; never invent mm/h. |
| Estimated salinity value, unit/state | A | Always show; keep distinct from EC. |
| Electrical conductivity value | B | Preserve as a distinct protocol value. It can use a smaller row because the current contract defines no EC threshold. |
| Normal/Warning/Critical/Info label for each metric | A | Use text/icon/color. The state logic should remain in presentation selectors and use settings/alerts where defined. |
| Configured safe range | B | Show in a tooltip, detail panel, or second line on focus/selection. |
| Recent sparkline | B | Useful direction-of-travel context; show for selected/priority metrics or in a telemetry drawer on the minimum viewport. |
| “Six inputs plus derived salinity” explanation | C | Documentation/help, not command-center content. |
| No EC threshold/boolean-protocol explanatory notes | C | Retain in detail/help, not in the primary grid. |

### 2.4 Control

| Visible information | Class | Current presentation and recommendation |
| --- | --- | --- |
| Current operating mode | A | Always visible; changing it must still update `/settings/{pondId}/mode`. |
| Automatic/manual selector and update state | A | Keep in the command center with a clear confirmation/error state. |
| Automatic-mode ownership explanation | B | Use concise inline help; longer copy can live in an info popover. |
| Disconnected-control explanation | A | Explain why commands are unavailable. |
| Aerator confirmed state and ON/OFF commands | A | Keep in the compact actuator area. Actual state remains subscribed device feedback. |
| Drainage pump confirmed state and commands | A | Keep in the compact actuator area. |
| Dilution pump confirmed state and commands | A | Keep in the compact actuator area. |
| Feeder confirmed state and commands | A | Keep in the compact actuator area. |
| Buzzer confirmed state | A | Read-only emergency output; always visible. |
| Warning beacon confirmed state | A | Read-only emergency output; always visible. |
| Pending/completed/failed command feedback | A | Keep beside the affected device. Never show requested state as confirmed state. |
| Command timestamp | B | Available in expanded device details or tooltip. |
| Device descriptions | B | Useful in an expanded control drawer; not needed on every compact tile. |
| Firebase path explanatory text | C | Debug/documentation detail; remove from the operational face. |
| “No command requested in this session” | C | Omit from compact tiles; show only in command history/details. |

### 2.5 History

| Visible information | Class | Current presentation and recommendation |
| --- | --- | --- |
| Loading and empty-history states | B | Required when the history view/drawer opens. |
| Record count and time range | B | Keep in the history drawer header. |
| Rainy-record count | B | Useful context for water-level/pH changes. |
| Chronological pH chart | B | Move to a wide history drawer/dialog. |
| Chronological dissolved-oxygen chart | B | Candidate for a small command-center trend; full chart remains secondary. |
| Chronological temperature chart | B | Move to history detail. |
| Chronological water-level chart | B | Candidate for a small command-center trend; full chart remains secondary. |
| Chronological EC chart | B | Move to history detail. |
| Chronological salinity chart | B | Move to history detail. |
| Latest, minimum, maximum, and timestamps per chart | B | Keep with the detailed chart. |
| Boolean-rain shaded regions | B | Retain as event regions, never convert to numeric rainfall. |
| “No prediction or diagnosis” explanatory copy | C | Keep in documentation/help or the drawer subtitle. |

### 2.6 Settings / Thresholds

| Visible information | Class | Current presentation and recommendation |
| --- | --- | --- |
| Current mode summary | B | Mode itself is A globally; the duplicate settings summary is secondary. |
| Boolean-rain/no rainfall-threshold note | C | Keep in settings help to prevent protocol misunderstandings. |
| pH `normalMin`, `normalMax`, `warningLow`, `warningHigh` | C | Edit in a settings drawer/dialog using exact protocol keys. |
| DO `normalMin`, `hypoxia`, `critical`, `recovery`, `triggerDurationSec` | C | Same. |
| Temperature normal/warning limits | C | Same. |
| Salinity normal/warning limits | C | Same; do not merge with EC. |
| Water-level normal/warning limits and `overflowTriggerDurationSec` | C | Same. |
| Three automation enable flags | C | Device-owned workflow configuration, not direct actuator controls. |
| Field units, descriptions, bounds, and validation errors | C | Retain in the form and localize. Validation should emit stable error codes rather than English sentences. |
| Unsaved changes/reset/save/saving/result feedback | C | Retain in a focus-managed settings workflow. |

### 2.7 Alerts / Events

| Visible information | Class | Current presentation and recommendation |
| --- | --- | --- |
| Active critical/warning environmental alerts | A | A compact live list remains always visible. |
| Alert type, severity, status, and message | A for active; B for resolved | Translate known types; preserve raw controller message as fallback/source content. |
| Alert measurements | A for an active emergency; B otherwise | Show the relevant measurement inline for active alerts. |
| Alert created time | A for active; B otherwise | Show relative age; exact localized timestamp on demand. |
| Alert resolved time | B | Full log detail. |
| Alert status/severity/type filters | C | Full-log drawer controls. |
| Alert ID | C | Diagnostic/audit detail. |
| Event type and source | B | Useful operational history; not normally always visible. |
| Event description, device, action, and reason | B | Full event log. Known protocol values get localized display labels; unknown text remains intact. |
| Event timestamp | B | Full event log. |
| Event type/source filters | C | Full-log drawer controls. |
| Event ID | C | Diagnostic/audit detail. |
| Empty/no-match states | B | Required inside the log drawer. |

## 3. One-screen desktop command-center design

### 3.1 Design objective

At desktop widths of 1366×768 and above, the authenticated application should use the viewport as a control-room surface, not as a series of document pages. It should avoid page-level vertical scrolling while keeping text and touch targets readable. A contained alert list or drawer may scroll independently.

The current six concepts are retained, but Overview becomes the persistent command center and the other views become detail surfaces. This changes composition, not data ownership or functionality.

### 3.2 Always-visible information

1. Pond name/identifier and overall `pond.status`.
2. Online, Stale, or Offline plus last-seen age.
3. Automatic/manual mode and mode-update feedback.
4. pH, dissolved oxygen, temperature, water level, rain, salinity, and separate EC.
5. Confirmed aerator, drainage pump, dilution pump, feeder, buzzer, and warning-beacon states.
6. Pending/failed state for any current manual command.
7. Most severe active alerts and active-alert count.
8. The responsive pond visualization.

The desktop header should also keep language selection, operator menu/logout, and buttons that open History, Settings, and Logs.

### 3.3 Proposed 1366×768 grid

Use the full viewport below a compact 60 px application bar. With 12 px workspace padding and gaps, the remaining 684 px can be allocated without reducing normal body text below 14–16 px.

```css
.command-center {
  height: 100dvh;
  display: grid;
  grid-template-rows: 60px minmax(0, 1fr);
  overflow: hidden;
}

.command-center__workspace {
  min-height: 0;
  padding: 12px;
  display: grid;
  grid-template-columns: 300px minmax(480px, 1fr) 304px;
  grid-template-rows: 72px minmax(300px, 1fr) 154px;
  grid-template-areas:
    "status    status    alerts"
    "sensors   pond      alerts"
    "actuators actuators alerts";
  gap: 12px;
  overflow: hidden;
}
```

Approximate 1366×768 allocation:

| Area | Approximate size | Contents |
| --- | --- | --- |
| Application bar | 1366×60 | Brand/pond, History, Settings, Logs, language, operator/logout. |
| Status strip | about 1010×72 | Overall status, freshness, mode, alert count, concise last-seen age. |
| Sensor rail | 300×434 | Seven compact sensor rows; DO and abnormal metrics receive visual priority. |
| Pond scene | about 698×434 | Interactive 3D or SVG fallback plus non-canvas text summary. |
| Actuator strip | about 1010×154 | Six compact confirmed-state tiles; four command buttons only when allowed. |
| Alert rail | 304×684 | Active alerts, severity, measurement, age, and “View all”; internal overflow only when necessary. |

The exact central width is fluid. Use `minmax(0, 1fr)` and `min-height: 0` consistently so the WebGL canvas, alert list, and panels do not force page overflow.

### 3.4 Detail surfaces

| Secondary function | Proposed surface | Behavior |
| --- | --- | --- |
| Full realtime detail and sparklines | Left or bottom detail drawer | Opens from a sensor row; retains seven distinct protocol fields. |
| Detailed history charts | Wide right drawer or modal dialog | About 70–85 vw on desktop, internally scrollable, URL/view state optional. |
| Threshold and automation editing | Wide modal/dialog | Focus trap, dirty-state confirmation, explicit Reset/Save. |
| Full alert and event history | Right drawer with Alert/Event segmented control | Filters and audit metadata remain available. |
| Device descriptions and command history | Device-detail popover/drawer | Confirmed state remains visible behind/alongside it. |
| System/debug information | Developer/details drawer | Includes pond ID, record IDs, raw paths, and mock scenario controls. Hide demo controls outside mock/development mode. |

Drawers/dialogs must be reachable by keyboard, have labelled close controls, restore focus to the opener, close on Escape when safe, and use internal scrolling. A settings dialog with unsaved changes should require a deliberate discard action rather than closing silently.

### 3.5 Responsive transitions

- **At or above about 1200 px and at least 700 px high:** use the fixed command-center grid with no page-level vertical scroll.
- **900–1199 px:** use a two-column layout: status across the top, pond plus sensors in the main column, alerts/actuators in the side column; vertical scrolling is acceptable if the available height is insufficient.
- **Below 900 px:** retain a single semantic document flow with vertical scrolling. Put status/freshness and active critical alerts before the visualization, sensors, and controls.
- **Narrow mobile:** use compact sensor cards and full-width 44 px minimum command targets. Never introduce horizontal scrolling for commands.
- **Short desktop windows:** prefer a documented responsive-height fallback to page scrolling rather than clipping information or shrinking typography.

## 4. Current SVG visualization audit

The current `PondVisualization` is an inline 620×300 SVG with a surrounding legend and a text alternative. It is a useful fallback and a strong state-binding reference.

| Existing visual element | Current binding | Audit finding |
| --- | --- | --- |
| Fixed trapezoidal bank/basin | Decorative | Dark bank colors align with the design system. |
| Water rectangle and dashed waterline | `sensors.waterLevel`, clamped to 0–100 | Correct protocol projection. |
| Seven animated rain strokes | `sensors.rain` | Correct boolean projection; no numeric rainfall is created. |
| Two paddlewheels | `devices.aerator` | Rotation correctly reflects confirmed device state. |
| Bubble circles | `devices.aerator` | Correct operational cue. |
| DO probe “active” state | Hardcoded `do >= 5.5` | Refactor: use the existing metric/settings selector or avoid a derived colored state. |
| pH probe “active” state | Hardcoded 7.5–8.5 | Refactor: do not keep visualization-specific thresholds. |
| Temperature probe “active” state | Hardcoded 28–32 °C | Refactor: do not keep visualization-specific thresholds. |
| Drain outlet and dashed flow | `devices.drainagePump` | Correct confirmed-state projection. |
| Intake and dashed flow | `devices.dilutionPump` | Correct confirmed-state projection. |
| Feeder marker | `devices.feeder` | Correct confirmed-state projection. |
| Warning marker | `buzzer`, `warningBeacon`, or non-normal `pond.status` | Correct inputs, but separate which output/state triggered the indication in the accessible summary. |
| Status-tinted background halo | `pond.status` | Retain as supplementary color, never the only status signal. |
| Water/rain/status legend and `<title>/<desc>` | Pond state and static text | Retain conceptually and localize all text. |

Missing capabilities include shrimp-pond context, spatially distinct probes, view interaction, quality scaling, renderer-failure handling, and a separate readable overlay for all critical state. The CSS already honors `prefers-reduced-motion`; the 3D implementation must do so inside its render loop and particle systems too.

## 5. Lightweight 3D visualization plan

### 5.1 Technical direction

Use Three.js through React Three Fiber for React lifecycle integration, with procedural primitives and instancing. Do not require downloaded GLTF models in the initial implementation. React Three Fiber's `Canvas` supports a fallback component, and its official performance guidance documents dynamic DPR/performance regression; Three.js exposes WebGL 2 capability checks and renderer diagnostics. Relevant official references:

- [React Three Fiber Canvas and fallback](https://r3f.docs.pmnd.rs/api/canvas)
- [React Three Fiber performance scaling](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- [Three.js WebGL capability check](https://threejs.org/docs/pages/WebGL.html)
- [Three.js WebGLRenderer capabilities and diagnostics](https://threejs.org/docs/pages/WebGLRenderer.html)

Recommended component boundary:

```text
PondVisualizationPanel
├── PondStatusSummary (semantic DOM; always rendered)
├── PondScene3DErrorBoundary
│   ├── PondSceneCanvas
│   │   ├── BasinAndEmbankment
│   │   ├── WaterBody
│   │   ├── AeratorAssembly
│   │   ├── DrainageOutlet
│   │   ├── DilutionIntake
│   │   ├── FeederAssembly
│   │   ├── SensorProbeGroup
│   │   ├── RainField
│   │   ├── WarningBeacon
│   │   └── PondContext
│   └── PondVisualizationSvgFallback
└── ViewControls (reset view / quality / accessible details)
```

`PondSceneCanvas` receives a derived, immutable `PondSceneViewModel`. The selector may normalize coordinates, labels, and tones, but it must not store new pond truth. It is recreated from existing `PondState` and existing presentation logic whenever subscribed data changes.

### 5.2 Exact state-to-scene mapping

| Existing domain state | 3D projection | Prohibited behavior |
| --- | --- | --- |
| `sensors.waterLevel` | Vertical water surface position and numeric label | No independent draggable water level. |
| `sensors.rain` | Visible rain lines/points and wet-surface cue | No numeric rate persisted or exposed as telemetry. |
| `sensors.ph`, `sensors.do`, `sensors.temperature` | Probe labels/readouts; tone from shared metric selector | No hardcoded 3D-only thresholds. |
| `sensors.ec`, `sensors.salinity` | Separate probe/detail readouts | Never merge or treat them as the same protocol field. |
| `devices.aerator` | Paddlewheel rotation, local ripples, and bubbles | Clicking the wheel must not mutate the device. |
| `devices.drainagePump` | Outlet flow particles/stream | No optimistic flow before confirmed device feedback. |
| `devices.dilutionPump` | Intake stream and local surface disturbance | Same. |
| `devices.feeder` | Feeder status lamp and optional feed particles | Same. |
| `devices.buzzer` | Audible-output icon/status in DOM; optional scene pulse | Do not play recurring audio by default. |
| `devices.warningBeacon` | Beacon emissive/pulse state | No invented alert state. |
| `pond.status` | Basin/status halo and beacon color | Never write or recompute pond status. |
| `connected` and freshness presentation | Separate overlay/frozen-data treatment | Offline/stale must not overwrite `pond.status`. |

Manual actions remain outside the scene or open the existing command UI. A selectable 3D device can focus its corresponding control tile, but the scene itself must never call a pond/device mutation. Commands still follow pending → confirmed device feedback → completed/failed.

### 5.3 Procedural scene elements

- **Basin and embankment:** low-poly rectangular or gently rounded basin using boxes, planes, and an extruded rim. Materials use existing dark-bank design tokens.
- **Water:** translucent plane or shallow box with a small vertex/shader ripple. Its Y position maps linearly to the clamped protocol percentage. No fluid simulation.
- **Shrimp-pond context:** a few low-poly or sprite/instanced shrimp silhouettes and pond-floor details. They are decorative context only and must not imply biomass, count, health, or tracked movement.
- **Aerator:** cylinders, paddles, and support beams grouped around a rotation axis. Only confirmed `aerator` state drives rotation, bubbles, and wake particles.
- **Drainage outlet and dilution intake:** simple pipe/cylinder assemblies with directional particles or short animated line segments when the confirmed pump is on.
- **Feeder:** cone/cylinder hopper, small status light, and sparse feed particles only while confirmed on.
- **Sensor probes:** thin cylinders with labelled DOM overlays or accessible detail controls; never rely on canvas text alone.
- **Rain:** instanced line geometry or points, capped by quality level. It is a visual boolean state, not an intensity measurement.
- **Warning beacon:** simple base/dome with emissive material. Animation follows beacon/buzzer/status and stops under reduced motion while retaining color, icon, and text.
- **Water movement/bubbles:** small instanced particles and subtle normal/vertex displacement. No collision or fluid physics.

### 5.4 Interaction and accessibility

- Use an isometric or mild-perspective default view that communicates the complete pond without user interaction.
- Constrain orbit to a modest yaw/pitch/zoom range; prevent inversion and navigation conflicts. Provide explicit semantic buttons for Reset view and optional preset views.
- Hotspots may select a sensor/device and reveal localized details in normal DOM. They must not be the only route to any information or control.
- Keep `PondStatusSummary` outside the canvas with pond status, water level, rain, and all actuator states for screen readers and fallback users.
- Announce only meaningful transitions, such as a newly active critical alert or command completion; do not announce animation frames or every telemetry sample.
- Under `prefers-reduced-motion`, stop continuous camera drift, wheel/rain/bubble/flow loops, and beacon pulsing. Show static geometry, directional glyphs, and text states instead.
- Ensure keyboard focus never enters dozens of scene objects. Expose a small, deliberate set of DOM controls and details.

## 6. Performance and fallback plan

Balanced should be the default. The user may select a local quality preference, but that preference is visualization configuration only and must not enter Firebase pond state.

| Capability | High | Balanced (default) | Low |
| --- | --- | --- | --- |
| Device pixel ratio | Up to 2, capped | 1–1.5 | 1 |
| Antialiasing | On | On if capability/performance permits | Off |
| Shadows | One restrained shadow map | Baked/contact cue or no dynamic shadow | None |
| Water | Lightweight animated shader/ripple | Reduced vertex/ripple rate | Static translucent surface |
| Rain/bubbles/flows | Higher capped instanced counts | Moderate instanced counts | Sparse/static directional cues |
| Shrimp context | Small animated instanced group | Small mostly static group | Omit or use static silhouettes |
| Target behavior | Smooth 60 fps where available | Stable 45–60 fps | Stable, optionally capped around 30 fps or demand-rendered |
| Post-processing | None initially; add only if measured safe | None | None |

Runtime rules:

1. Capability-check WebGL 2 before mounting the scene.
2. Start Balanced; use measured frame performance to reduce DPR and particle counts. Limit downgrade/upgrade oscillation and remember a session-level fallback once the lowest tier is reached.
3. Pause animation and telemetry-only visual interpolation while the tab is hidden or the scene is outside the viewport.
4. Use instancing and shared geometry/materials; avoid per-frame React state updates and avoid object allocation in the render loop.
5. Lazy-load the 3D bundle after the operational DOM is available. The header, statuses, sensors, controls, and alert rail must not wait for WebGL.
6. Dispose geometries/materials/render targets on unmount and observe renderer memory/draw-call diagnostics during development.
7. Test context-loss handling. On initialization error or context loss, replace the canvas with the current SVG fallback and a localized, non-alarming fallback note; offer one retry.
8. If WebGL is unavailable, JavaScript is constrained, reduced motion is requested, or repeated performance fallback occurs, the SVG remains fully functional. Reduced motion alone does not require SVG if a static 3D frame is reliable.

Acceptance budgets to confirm during implementation, not assumptions for this audit:

- No page-level overflow at 1366×768 with default browser zoom and normal English/Vietnamese strings.
- 3D bundle lazy-loaded and reported separately in the build output.
- No unbounded particle/object growth after scenario changes.
- No animation work when the document is hidden.
- DOM operational controls remain usable while the scene loads or fails.

## 7. Internationalization audit

### 7.1 Current state

There is no locale provider or translation catalog. Most UI text is English and is embedded in components, presentation configuration, validation functions, auth hooks, and data-source errors. Rain is already rendered with Vietnamese strings (`Có mưa` / `Không mưa`) inside an otherwise English screen, demonstrating why string ownership must be centralized. Dates use browser-default formatting rather than an explicit selected locale.

The inventory below groups the hardcoded user-facing string families. Repeated labels such as Normal, Warning, and Critical should have one canonical key rather than duplicated translations.

### 7.2 Required namespaces and string inventory

#### `common`

- Product name/subtitle, current pond, pond identifier, operator label, logout.
- Online, Stale, Offline; Normal, Warning, Critical, Info; Automatic, Manual.
- ON/OFF, active/resolved, all, unknown/unavailable, loading, save, reset, close, retry, view details.
- Last seen, created, resolved, from, to, count/record/sample plurals.
- Date/time, relative-time, number, decimal, and unit formatting.
- Generic empty, loading, and read-only text.

#### `auth`

- Farmer access, secure dashboard access, sign-in title and provider/password explanation.
- Email, password, Sign in, Signing in, Preparing dashboard.
- Session restoration, invalid credentials, sign-in failure, farmer-role requirement, and sign-out errors.
- Replace “Checking the local mock session” with a source-neutral loading message; the current text is wrong in Firebase mode.

#### `dashboard`

- Navigation labels: Overview, Realtime, Control, History, Settings / Thresholds, Alerts & Events.
- Overview/realtime headings and descriptions.
- Connection, pond status, operating mode, active alerts, actuators, running/all inactive.
- Loading pond data, opening subscriptions, data unavailable, no pond/settings data.
- Controller disconnected and stale-heartbeat warning copy.
- Current pond and navigation ARIA labels.

#### `sensors`

- pH, dissolved oxygen, temperature, water level, rain state, electrical conductivity, estimated salinity.
- Rain/No rain (`Có mưa` / `Không mưa`).
- Metric state labels, safe range, safe range unavailable, normal/recovery descriptions.
- Boolean sensor explanation and no-configured-EC-threshold note.
- Units and accessible value templates. Units such as pH, mg/L, °C, %, and ppt need a centralized display policy rather than ad-hoc translation.

#### `devices`

- Aerator, drainage pump, dilution pump, feeder, alarm buzzer, warning beacon, plus short labels used in summaries.
- Existing device descriptions.
- Confirmed ON/OFF, Turn on/off, read-only controller state, safety outputs, command-enabled actuators.
- Automatic/manual ownership copy and disconnected-control explanation.
- Pending/requesting, completed/confirming, failed/retry, updating settings, command timestamp, and duplicate-pending errors.
- Pond visualization device labels currently embedded as DRAIN, INTAKE, and FEED.

#### `alerts`

- Active alerts, controller warnings, environmental conditions, no active alerts, no published/matching alerts.
- Status/severity/type filter labels and options.
- Alert ID, created/resolved/not resolved, measurements.
- Known types: `hypoxia`, `rain_overflow`, `heat_salinity`.
- Known mock-controller messages for low DO, rain overflow, and heat/salinity conditions.
- Active-alert live-region templates and singular/plural counts.

#### `events`

- Alerts-versus-events explanation, actions/system history, no published/matching events.
- Type/source filters, Event ID, created, device, action, reason.
- Known types: `device_action`, `mode_change`, `threshold_change`, `connection`, `workflow_started`, `workflow_resolved`.
- Source/action labels: manual, automatic, unspecified, on, off.
- Current generic event descriptions for each known event type.

#### `settings`

- Thresholds and automation heading/description; mode summary.
- Boolean-rain/no-rainfall-rate-threshold explanation.
- pH, DO, temperature, salinity, and water-level group descriptions.
- Normal minimum/maximum, warning low/high, hypoxia, critical, recovery, trigger duration, overflow duration, seconds.
- Three automation workflow names/descriptions and device-ownership explanation.
- Invalid-field count, ordering/range explanation, save/reset/saving/saved/reset-result/error strings.
- All validation errors currently returned as English sentences from `settingsValidation.ts`.

#### `history`

- Loading/empty telemetry history, recent water-quality records, record count, time range, rain-sample count.
- Chart labels and accessibility summaries: latest, minimum, maximum, record count, timestamp.
- Boolean-rain shaded-region legend.
- No prediction/diagnosis explanation.

#### `scenario`

- Demo scenario controls, Demo control.
- Normal, Hypoxia, Rain overflow, Heat + salinity.
- Development-only/fake-data explanation to prevent confusion with production controls.

#### `visualization`

- Realtime pond visualization, water/device-state heading, Water level.
- Rain and flow, Running, Pond status.
- Accessible description template containing status, water percentage, rain, and confirmed actuator states.
- Reset view, preset view names, quality labels, loading 3D, WebGL/SVG fallback note, retry renderer.

#### `errors`

- Could not restore session/sign in/load or refresh telemetry/subscribe to pond data.
- Could not update mode/create command/save settings.
- Invalid mock credentials/profile, missing Firebase profile, farmer authorization, sign-in-required, access-denied, and unavailable-data messages.
- Renderer initialization/context-loss errors.

### 7.3 Translation organization

Use `i18next` with `react-i18next` and explicit namespaces. The official React integration supports namespace-bound hooks, and i18next supports language and namespace fallbacks:

- [react-i18next `useTranslation`](https://react.i18next.com/latest/usetranslation-hook)
- [i18next language and namespace fallback](https://www.i18next.com/principles/fallback)

Proposed structure:

```text
web/src/i18n/
├── index.ts
├── types.ts
├── formatters.ts
├── resources.ts
└── locales/
    ├── en/
    │   ├── common.json
    │   ├── auth.json
    │   ├── dashboard.json
    │   ├── sensors.json
    │   ├── devices.json
    │   ├── alerts.json
    │   ├── events.json
    │   ├── settings.json
    │   ├── history.json
    │   ├── scenario.json
    │   ├── visualization.json
    │   └── errors.json
    └── vi/
        └── matching files and keys
```

Implementation rules for the later localization phase:

1. Support exactly `vi` and `en` initially, with a visible language selector in the application and login headers.
2. Persist only the UI locale in local storage. It is not pond configuration and must not be written to Firebase.
3. Set `document.documentElement.lang` on locale changes and use `Intl.NumberFormat`, `Intl.DateTimeFormat`, and `Intl.RelativeTimeFormat` with the selected locale.
4. Use stable semantic keys such as `devices.aerator`, not English phrases as keys. Add a compile/test-time key-parity check between `en` and `vi`.
5. Use proper pluralization/interpolation for records, alerts, rain samples, and invalid-field counts. Do not concatenate translated fragments where grammar may differ.
6. Convert validation and known application failures to stable error codes plus parameters. Translate at the presentation boundary. Keep an unknown/raw error fallback for diagnostics.
7. Map protocol enums to translated labels without changing their stored values. For example, stored `rain_overflow` remains unchanged while the UI calls `t("alerts:types.rain_overflow")`.
8. User-provided pond names/display names, identifiers, arbitrary event reasons, and arbitrary Firebase alert messages are content, not translation keys. Translate known alert/event types and produce a localized structured summary from type plus measurements where possible; show unknown raw messages safely as fallback/source detail.
9. Audit ARIA labels, SVG descriptions, live regions, tooltips, placeholders, title attributes, empty states, and errors—not only visible paragraph text.
10. Test both languages at 1366×768 and 320 CSS px. Vietnamese and English have different expansion patterns; the command-center layout must not depend on one language's string length.

## 8. Reuse and refactor assessment

### Reuse without architectural change

- All domain types and Firebase field names in `web/src/domain`.
- `PondDataSource`, `MockPondDataSource`, `FirebasePondDataSource`, source selection, and subscriptions.
- Mock scenario engine and its separation from the Firebase protocol.
- Authentication/session lifecycle.
- Command creation and pending/device-feedback/completed/failed lifecycle.
- Telemetry ordering/query logic, alert/event filter logic, and settings-write flow.
- Design tokens and the dark aquatic status palette.
- `StatusBadge`, `Sparkline`, and most existing card styling concepts.
- Existing SVG `PondVisualization` as the WebGL/reduced-capability fallback after string and threshold-state refactoring.

### Refactor while preserving behavior

- **`AppShell`:** change from six full page-like tabs to a persistent command-center composition plus accessible detail drawers/dialogs. Keep a usable route/view model so deep links and mobile presentation remain possible.
- **Overview:** split summary data into compact `StatusStrip`, `SensorRail`, `ActuatorStrip`, and `ActiveAlertRail` variants.
- **`MetricCard` and metric view models:** add compact and detailed variants; replace embedded English labels/state text with translation keys or semantic values.
- **`DeviceControlPanel`:** extract compact actuator tiles and an expanded detail surface. Reuse the existing command methods and confirmed-state rules unchanged.
- **`ActiveAlertsPanel`:** create an always-visible emergency summary and reuse the full record renderer in the logs drawer.
- **`TelemetryHistoryView`:** render inside a wide drawer/dialog and allow a small selected-metric trend in the command center.
- **`SettingsView`:** render inside a focus-managed dialog/drawer; keep exact schema, validation, Reset, and Save behavior.
- **`AlertsEventsView`:** retain separate Alerts and Events concepts but move filters/full history into a detail surface.
- **`PondVisualization`:** remove visualization-specific fixed thresholds, localize accessible content, and rename it as the explicit SVG fallback when the 3D scene lands.
- **Presentation/validation helpers:** return semantic states, protocol keys, and stable error codes instead of English display strings.
- **Timestamp/number helpers:** accept selected locale and use `Intl` consistently.
- **Loading/auth screens:** localize and remove the mock-specific session message in Firebase mode.

### New components/modules required later

- I18n initialization, typed resource access, locale formatter helpers, and language switcher.
- Command-center layout primitives and accessible drawer/dialog primitives.
- `PondSceneViewModel` pure selector.
- Lazy-loaded `PondSceneCanvas` and procedural scene subcomponents.
- WebGL capability check, quality selection/monitor, context-loss handling, and error boundary.
- DOM-based pond status summary and scene view controls.
- Translation key-parity and hardcoded-user-string regression tests.

## 9. Migration checklist

### Stage 1 — Localization foundation

- [ ] Add `i18next`/`react-i18next`, typed namespace resources, `vi` and `en`, and explicit fallback language.
- [ ] Add locale selector, persistence, document `lang`, and locale-aware formatters.
- [ ] Convert shared statuses, auth, shell, sensors, devices, alerts/events, settings, history, scenario, errors, visualization text, ARIA labels, and live-region text.
- [ ] Convert validation/application errors to stable codes and keep raw unknown-error fallback.
- [ ] Add English/Vietnamese key-parity, pluralization, and no-obvious-hardcoded-UI-string tests.

### Stage 2 — Command-center viewport

- [ ] Introduce the fixed desktop grid and responsive-height fallback.
- [ ] Build compact status, sensor, actuator, and active-alert regions from existing selectors/subscriptions.
- [ ] Keep current command lifecycle and mode write behavior intact.
- [ ] Move demo scenarios to a mock/development drawer.
- [ ] Move History, Settings, full Alerts/Events, telemetry details, and debug details into accessible overlays.
- [ ] Verify no page-level vertical overflow at 1366×768, 1440×900, and 1920×1080; verify intentional document flow on tablet/mobile.

### Stage 3 — 3D projection and fallback

- [ ] Extract a pure `PondSceneViewModel` with exact state mappings and no mutations.
- [ ] Refactor/localize the current SVG and retain it as fallback.
- [ ] Lazy-load the WebGL bundle after operational DOM content.
- [ ] Implement procedural basin, water, equipment, probes, rain, warning, and decorative pond context.
- [ ] Add constrained view-only interaction and equivalent DOM details.
- [ ] Prove that changing scenarios affects the scene only through `PondDataSource` subscriptions and that no scene component imports mock fixtures or mutates pond/device state.

### Stage 4 — Performance and accessibility

- [ ] Implement High/Balanced/Low levels, with Balanced default and automatic one-way degradation safeguards.
- [ ] Cap DPR/particles/draw calls, reuse geometry/materials, pause hidden work, and test cleanup.
- [ ] Handle unsupported WebGL, initialization failure, and context loss with the SVG fallback.
- [ ] Honor reduced motion inside the 3D render loop and preserve static state cues.
- [ ] Test keyboard-only operation, focus restoration, screen-reader summaries/live regions, 200% zoom, contrast, and language switching.

### Stage 5 — Regression and acceptance verification

- [ ] Verify Normal, Hypoxia, Rain Overflow, and Heat/Salinity through subscribed protocol state, with no scenario-name checks in feature components.
- [ ] Verify automatic mode disables commands while automatic mock responses continue.
- [ ] Verify manual command pending → device feedback → completed/failed without optimistic actuator mutation.
- [ ] Verify online, stale, offline, loading, empty telemetry, empty alerts, and failed-renderer states in both languages.
- [ ] Measure layout and rendering on representative integrated/low-power hardware where available.
- [ ] Run lint, typecheck, focused tests, full tests, and production build at the end of each implementation phase.

## 10. Non-goals and protocol safeguards

- No Firebase path, field, enum, permission, or security-rule changes.
- No IoT firmware changes.
- No physics, water-quality prediction, diagnosis, numeric rainfall, or photorealism requirement.
- No 3D-only operational state and no direct device/sensor mutation.
- No merging of `ec` and `salinity`.
- No optimistic actuator animation before confirmed `/ponds/{pondId}/devices` feedback.
- No inference that decorative shrimp represent a real shrimp count, biomass, or health metric.
- No production scenario selector; it remains a mock/development affordance only.

## 11. Phase 9 completion criteria

This audit is complete when this plan is present and reviewed. Runtime implementation belongs to later explicitly requested phases. The first implementation phase should begin with localization and semantic state extraction because both the new command-center composition and the 3D accessible summary depend on those foundations.

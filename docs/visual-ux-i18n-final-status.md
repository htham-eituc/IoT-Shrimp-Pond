# Smart Shrimp Pond — Visual, UX, i18n, and 3D final status

## Scope and outcome

Phase 15 completed a QA and bounded optimization pass over the existing command center. It did not change the Firebase Realtime Database contract, command lifecycle, authentication model, IoT ownership rules, or firmware.

The automated browser matrix covered 40 desktop combinations (five viewports × four scenarios × two locales), six tablet/mobile combinations, and twelve localized drawer/dialog workflow cases. The final run reported no layout, horizontal-overflow, clipping, untranslated-key, mixed-language, or scenario-projection failures.

## Phase 35 realtime, simulation, sensor UI, and circle QA addendum

Phase 35 rechecked the dashboard after the realtime stale-data, closed-loop mock simulation, shared sparkline layout, and true-circle fixes from Phases 31–34. No product features were added and no Firebase, IoT, command, or `PondDataSource` protocol fields were changed.

### Stale-data root cause and lifecycle fix

The stale-value risk was old asynchronous work continuing to resolve after the dashboard had switched data source or pond scope. That could leave previous pond snapshots or telemetry visible while newer subscriptions were already active.

The current dashboard state is scoped by both `dataSource` and `pondId`. Subscription callbacks and telemetry refreshes commit only when their scope is still current, cleanup unsubscribes every realtime listener on unmount/scope change, and complete `PondState` snapshots replace prior sensor/device objects instead of merging nested values. Regression tests cover:

- stale updates from an old data source being ignored;
- stale updates from an old pond id being ignored;
- fresh authorized mock sessions starting from a new pond snapshot rather than previous user-local state;
- duplicate mock pond listeners not surviving unsubscribe/remount.

### Live freshness QA

Freshness remains a presentation projection of `connected` and `lastSeenMs`:

| Input state | Result |
| --- | --- |
| `connected=true` and heartbeat within the stale window | Live / `Đang cập nhật` |
| `connected=true` and heartbeat older than the stale window | Data delayed / `Dữ liệu chậm` |
| `connected=false` | Offline / `Mất kết nối` |

Automated tests verify the stale threshold boundary and the localized wording. Device connectivity is still separate from pond severity and does not rewrite `pond.status`.

### Closed-loop simulation model

The mock IoT controller now owns dynamic environmental evolution behind `MockPondDataSource`. Scenario names stay inside the mock/demo controller and are not part of the Firebase protocol.

| Scenario/control | Verified relationship |
| --- | --- |
| Normal | Sensor values drift toward stable configured-normal conditions. |
| Hypoxia | DO decreases, automatic aeration starts, feeder stops, buzzer/beacon activate, DO recovers under aeration, and hypoxia alerts resolve after normal recovery. |
| Rain overflow | Boolean `rain` becomes true, water rises above overflow level, drainage/aeration activate, water level later decreases, and the pump stops on recovery. |
| Heat + salinity | Temperature/salinity rise, dilution activates, feeder stops, salinity and EC decrease under dilution, and the heat/salinity workflow resolves on recovery. |
| Manual aerator ON | Command remains pending until device feedback, then `devices.aerator` turns on and DO improves over subsequent simulation steps. |
| Manual drainage ON | Command completion updates `devices.drainagePump`, then water level decreases over subsequent simulation steps. |
| Manual dilution ON | Command completion updates `devices.dilutionPump`, then salinity and EC decrease over subsequent simulation steps. |

Telemetry remains Firebase-shaped at `/telemetry/{pondId}/{timestampMs}` with `timestampMs`, `ph`, `do`, `temperature`, `waterLevel`, `rain`, `ec`, and `salinity`. The mock keeps visual rain intensity internal and never writes a rainfall-rate field into pond sensors or telemetry.

### Sensor mini-chart and circle geometry QA

All six primary compact cards now share the same layout contract: header, body, and footer trend slot. The combined Conductivity / Salinity card uses salinity as the primary compact trend and keeps EC visible as a secondary measured value; History still exposes EC and salinity as independent series.

True-circle controls were fixed at the design-system level. Circle-like controls now use equal inline/block size, matching min-size, `aspect-ratio: 1 / 1`, zero padding, `flex: 0 0 auto`, and `border-radius: 50%`. The responsive layer increases the shared circle size rather than only increasing height.

Browser measurement during the Phase 34 pass confirmed VI, EN, DO, pH, T°, and representative 3D hotspots at `1920×1080`, `1366×768`, `1024×768`, and `390×844` rendered with equal width and height. Phase 35 retained that CSS without further geometry changes.

### 3D state synchronization QA

Static scan and tests confirm `Pond3D` renders from `PondState`/presentation models, not mock scenario names. Scenario strings appear only in demo-shell controls and tests. The 3D projection maps:

- `sensors.waterLevel` to interpolated visual water height;
- `sensors.rain` to rain visuals;
- `devices.aerator` to paddlewheel/bubble activity;
- `devices.drainagePump` to outward flow;
- `devices.dilutionPump` to inward flow;
- `devices.feeder` to feeder state;
- `devices.warningBeacon` and `devices.buzzer` to warning indicators;
- `pond.status` to subtle scene severity cues.

The scene model tests verify projection without mutating the source `PondState`, anchor positions for all interactive sensor/device targets, WebGL fallback selection, and all mock scenario outcomes through `PondDataSource` subscriptions.

### Phase 35 verification status

| Area | Status | Evidence |
| --- | --- | --- |
| Stale data and subscription lifecycle | Pass | `usePondDashboard.test.ts`, `MockPondDataSource.test.ts`, `createPondDataSource.test.ts` |
| Live/stale/offline freshness | Pass | `connection.test.ts` |
| Closed-loop demo scenarios | Pass | `MockPondDataSource.test.ts` |
| Manual actuator effect on sensors | Pass | `MockPondDataSource.test.ts` |
| Shared sensor mini-chart layout | Pass | `conductivitySalinityCard.test.tsx` |
| Circle geometry implementation | Pass | Phase 34 browser measurements plus retained design-system CSS |
| Pond3D state-driven projection | Pass | `pondSceneModel.test.ts` and static scan of `web/src/components/Pond3D` |
| i18n regression | Pass | Full test suite plus existing locale coverage |
| Real Firebase account success flow | Not confirmed in this environment | Local dev reached Firebase Authentication, but the supplied account/config returned an Identity Toolkit 400 and the dashboard was not authorized. No credential was committed, documented, or stored by application code. |

Because real Firebase authentication did not complete, the login → Firebase → authorized dashboard, refresh-after-real-login, logout-after-real-login, and User A → User B browser flows were not manually confirmed in this Phase 35 run. The corresponding lifecycle protections remain covered by unit tests and should be re-run with a known-valid farmer account and matching `/users/{uid}` metadata in Firebase Console.

## Phase 30 final polish QA addendum

Phase 30 rechecked the dashboard after the focused UI/responsive/typography/3D polish track from Phases 25–29. One small regression was fixed during this pass: at `1280×720`, the current pond name in the command-center header was still clipped by a narrow breakpoint override. The breakpoint now allows a wider pond identity block without reintroducing horizontal overflow or page-level desktop scrolling.

Runtime QA used the real Firebase Authentication flow with a farmer account supplied for the test session, then exercised the dashboard with `VITE_DATA_MODE=mock`. No credential was committed, written to source files, documented, or stored by application code during the QA pass.

### Reported issue verification

| Reported issue | Phase 30 result |
| --- | --- |
| Conductivity / Salinity card sparkline position | Pass. The sparkline remains in `.metric-card__composite-trend`, appears after the value list, and stayed within the card bounds in every measured viewport and both locales. |
| Responsive behavior | Pass with one fix. No unintended horizontal overflow was measured across the full viewport matrix. Desktop viewports fit without page-level vertical scroll; tablet/mobile scroll vertically as intended. |
| Font sizes / readability | Pass. The typography scale and responsive overrides kept primary values, device labels, buttons, status chips, and helper text readable in VI and EN. No measured text clipping remained after the 1280×720 header fix. |
| 3D hotspot alignment and visual upgrade | Pass. Browser QA measured all nine interactive 3D overlays/probes as projected, visible, and inside the pond figure at the constrained desktop viewport. Unit tests also cover shared camera projection across desktop/tablet shapes. |

### Phase 30 viewport matrix

The matrix below was measured in the authenticated dashboard with Playwright. Desktop viewports are expected to avoid page-level scroll; tablet and mobile intentionally allow vertical page scrolling for readability.

| Viewport | VI | EN | Horizontal scroll | Page vertical scroll | Notes |
| --- | --- | --- | --- | --- | --- |
| 1920×1080 | Pass | Pass | None | None | 3D area about 1169×649; six sensor cards and six device cards visible. |
| 1600×900 | Pass | Pass | None | None | 3D area about 972×510; header and language control visible. |
| 1440×900 | Pass | Pass | None | None | 3D area about 801×522; no clipping. |
| 1366×768 | Pass | Pass | None | None | 3D area about 759×390; hotspot overlay count 9/9 ready. |
| 1280×720 | Pass after fix | Pass after fix | None | None | Pond name clipping fixed; no desktop scrollbar introduced. |
| 1024×768 | Pass | Pass | None | Expected vertical scroll | Tablet layout stacks content; 3D area about 987×495. |
| 820×1180 | Pass | Pass | None | Expected vertical scroll | Two-column tablet cards; language and mode visible. |
| 768×1024 | Pass | Pass | None | Expected vertical scroll | Tablet portrait layout remains readable. |
| 430×932 | Pass | Pass | None | Expected vertical scroll | Mobile cards usable; composite sparkline remains inside card. |
| 390×844 | Pass | Pass | None | Expected vertical scroll | Mobile one-column/tight layout; no text clipping. |
| 375×812 | Pass | Pass | None | Expected vertical scroll | Mobile layout remains usable. |
| 360×800 | Pass | Pass | None | Expected vertical scroll | Narrowest checked viewport; no horizontal overflow. |

### Phase 30 3D and accessibility notes

- The 3D scene now logs zero browser console errors in the checked session.
- The Phase 29 shadow-map warning was removed by using the non-deprecated R3F `percentage` shadow tier. One remaining development-console warning comes from the current Three/R3F dependency path using deprecated `THREE.Clock`; this is not emitted by application code.
- Reduced-motion emulation selected low 3D quality and set `data-reduced-motion="true"` on the 3D canvas wrapper; returning to normal motion restored `data-reduced-motion="false"` and balanced quality at the checked viewport.
- Keyboard traversal at `1366×768` reached the language controls, user menu, History and Settings actions, scenario selector, probe buttons, and 3D hotspots with visible focus outlines.
- Mock scenario switching at `1366×768` kept the dashboard free of horizontal overflow and page-level vertical scroll, and all projected 3D hotspots/probes remained inside the pond figure.

## One-screen desktop behavior

The primary monitoring screen fits without body/page vertical scrolling at every tested desktop size. The header, language selector, operating mode, active-alert region, seven sensor values presented in six cards, six device states, and 3D pond remain visible together. Secondary charts, configuration, logs, and command details remain in a single contextual drawer.

| Viewport | VI | EN | Page scroll | Horizontal scroll | 3D quality |
| --- | --- | --- | --- | --- | --- |
| 1280×720 | Pass | Pass | None | None | Balanced |
| 1366×768 | Pass | Pass | None | None | Balanced |
| 1440×900 | Pass | Pass | None | None | Balanced |
| 1536×864 | Pass | Pass | None | None | High |
| 1920×1080 | Pass | Pass | None | None | High |

At 1366×768, the 3D area measured approximately 797×402 CSS pixels and remained subordinate to the alert/sensor hierarchy. Critical alerts reallocate the right-side grid to keep the alert and abnormal sensor visible without pushing device status below the viewport.

Tablet and mobile intentionally use page scrolling rather than unreadably small text:

| Viewport | Result | Page behavior | 3D quality |
| --- | --- | --- | --- |
| 1024×768 | Pass in VI and EN | Vertical scrolling; no horizontal overflow | Balanced |
| 768×1024 | Pass in VI and EN | Vertical scrolling; no horizontal overflow | Low |
| 390×844 | Pass in VI and EN | Vertical scrolling; no horizontal overflow | Low |

### Phase 23 density recheck

After combining EC and salinity, an isolated headless-Chrome regression mounted the
real authenticated shell components with `MockPondDataSource`. It did not install
or expose a runtime authentication bypass. The focused matrix passed in VI and EN:

| Viewport | Primary cards | Grid | Page scroll | Horizontal scroll |
| --- | ---: | --- | --- | --- |
| 1280×720 | 6 | Balanced 2×3 | None | None |
| 1366×768 | 6 | Balanced 2×3 | None | None |
| 1440×900 | 6 | Balanced 2×3 | None | None |
| 1920×1080 | 6 | Balanced 2×3 | None | None |

Header, alerts, devices, and pond visualization remained visible in all eight
locale/viewport combinations. At 1366×768 the composite card measured approximately
254×80 CSS pixels, matching the surrounding card footprint.

## Composite EC and salinity presentation

The compact command-center matrix projects the independent `sensors.ec` and
`sensors.salinity` fields into one card. Salinity is the emphasized farmer-facing
value in `ppt`; EC remains visible using the project's existing blank-unit
convention. No EC unit or database status was invented.

The composite tone is the more severe applicable existing presentation tone. A
small salinity trend is retained, while the Realtime detail view and History drawer
continue to expose EC and salinity as separate metrics and telemetry series. EC and
salinity focus requests resolve to the same primary card without changing either
underlying value.

## Supported languages and i18n QA

The application supports exactly Vietnamese (`vi`) and English (`en`), with Vietnamese as the default. The selected locale remains a local UI preference and is not written into the pond protocol.

QA covered the primary dashboard, realtime details, control details, history, thresholds/automation, alerts/events, settings confirmation, scenarios, empty states, failure states, and command feedback in both languages. Checks included:

- namespace-key parity and no exposed translation keys;
- no mixed-language primary workflow/dialog content;
- no clipped operational labels or buttons in the test matrix;
- localized singular/plural history and alert labels;
- locale-aware number, percentage, timestamp, date, and relative-time formatters;
- localized accessible names for the language control and operational actions.
- localized Remember me, Show/Hide password, Signing in, Welcome, account menu,
  Sign out, sign-out confirmation, and Conductivity / Salinity strings.

Protocol values such as `automatic`, `critical`, `pending`, and `rain_overflow` remain unchanged in data objects and are translated only at presentation boundaries.

## 3D implementation and state mapping

The 3D scene remains a projection of `PondState` and uses no scenario-name logic.

| Domain state | 3D projection |
| --- | --- |
| `sensors.waterLevel` | Interpolated water-surface and equipment height |
| `sensors.rain` | Boolean rain lines and rain-adjusted water appearance |
| `devices.aerator` | Paddlewheel rotation and local bubbles |
| `devices.drainagePump` | Outward outlet-flow indicator |
| `devices.dilutionPump` | Inward intake-flow indicator |
| `devices.feeder` | Feeder state and restrained feed particles |
| `devices.warningBeacon` | Visual beacon pulse |
| `devices.buzzer` | Silent visual buzzer rings |
| `pond.status` | Subtle scene boundary/status marker |
| sensor presentation models | Probe tone and accessible probe details |

Text values update immediately. Water-height interpolation is visual only and never writes back to the domain state. Manual button intent does not change scene equipment; the scene changes only after subscribed device feedback updates `pond.devices`.

## Performance decisions

The scene now uses appearance-only adaptive quality:

- **High:** capable viewports from 1536 px, DPR capped at 1.75, full procedural particles, antialiasing enabled.
- **Balanced:** constrained desktops and 1024 px tablet, DPR capped at 1.35, reduced rain particles, antialiasing enabled.
- **Low:** viewports below 900 px, devices reporting at most 4 GB memory, or reduced-motion preference; DPR 1, antialiasing disabled, minimal rain/feed/bubble geometry.

Quality never changes sensor values, device state, alert severity, pond status, or safety interpretation.

Additional decisions:

- Three.js animation mutates Three.js refs through `useFrame`; it does not call React state setters per frame.
- Idle and reduced-motion scenes use demand rendering.
- Telemetry records are not passed into `PondSceneCanvas`; telemetry refreshes therefore do not recreate the 3D scene.
- Static environment, basin, and camera components are memoized.
- The flat water surface uses a 1×1 plane instead of unused 20×12 subdivision.
- Rain positions are memoized, and particle counts follow the visual quality tier.
- Resize animation-frame work and media/event listeners have explicit cleanup.
- Detail views are conditionally mounted; hidden history charts do not remain rendered.
- React Three Fiber unmount cleanup disposes the scene graph and renderer resources. Browser QA observed one canvas before/during/after drawer use and zero canvases after logout.

A two-second active-scene diagnostic in headless development Chrome recorded zero DOM-node growth, zero style recalculations, four layouts, and approximately 0.80 seconds of task duration. This is a software-rendered diagnostic, not a production-device FPS benchmark.

## Reduced motion and accessibility

With `prefers-reduced-motion: reduce`, browser QA confirmed the scene selected low quality and exposed `data-reduced-motion="true"`. The canvas switches to demand rendering, equipment/rain/feed loops stop or become static state indicators, and CSS looping animation is reduced to one near-instant iteration.

Accessibility verification confirmed:

- visible 3 px focus outline;
- semantic buttons and meaningful localized accessible names;
- language selector uses a labelled group with exactly one `aria-pressed` option;
- status badges include an icon and explicit text, not color alone;
- the 3D figure references a localized textual description of status, water, rain, and active equipment;
- drawers focus their close button, trap focus, close with Escape, and restore prior focus;
- the settings confirmation focuses Cancel, traps focus, and Escape closes only the confirmation—not its parent drawer;
- failed commands are announced as alerts.

## Scenario and control QA

All four mock scenarios passed in both languages at all five desktop viewports:

- **normal:** normal pond status, no active emergency alert, emergency devices inactive;
- **hypoxia:** low/critical DO, critical pond state, aerator active, feeder stopped, beacon active, critical alert visible;
- **rain_overflow:** boolean rain visible, high water visible, drainage and aeration active, alert visible;
- **heat_salinity:** abnormal temperature/salinity, dilution intake active, feeder stopped, alert visible.

Focused composite-card tests also project all four scenario states without checking
scenario names in presentation code. The normal, hypoxia, and rain-overflow inputs
leave the card normal where their EC/salinity values are normal; heat-salinity raises
the combined card to warning through the subscribed salinity value and active alert.

Automatic mode kept manual command buttons visible but disabled. Manual mode exposed four controllable actuators. A real browser command check observed:

1. confirmed aerator `OFF`;
2. command `pending`, button disabled, confirmed state still `OFF`;
3. controller feedback changed the confirmed state to `ON`;
4. command displayed `completed`.

Failed-command UI was verified with a Firebase-shaped failed command fixture and is exposed through an assertive alert role. The mock IoT engine itself normally completes valid commands and does not randomly fail them.

## Failure and fallback behavior

- **WebGL unavailable:** verified in Chrome launched with WebGL disabled; localized 2D SVG fallback rendered, the dashboard remained usable, no horizontal overflow or runtime exception occurred.
- **Disconnected pond:** localized state and disabled manual actions covered by component tests.
- **Stale `lastSeenMs`:** connection classification and localized stale overlay covered by unit/component tests.
- **No telemetry:** localized empty-history state covered in both languages.
- **Firebase/data source unavailable:** localized actionable error and retry UI is present; factory/configuration safety remains tested without committing credentials.
- **Empty alerts:** localized healthy empty state covered in both languages.
- **No active commands:** localized idle command feedback covered in both languages.
- **Failed command:** explicit localized failure presentation and alert semantics covered in both languages.

## Verification commands

Run from `web/`:

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

Additional QA used local Vite plus headless Chrome DevTools Protocol at the listed viewports. A separate isolated Chrome process used `--disable-webgl` for fallback verification. Source scans checked JSX user-facing literals and translation namespace parity.

The Phase 23 final suite passed 19 test files and 119 tests. Its focused preflight
ran 71 auth, i18n, data-source, and composite-card tests before the full suite.

## Remaining limitations

- Live Firebase connectivity, permission failures, and latency could not be exercised without authorized external credentials; no real credentials were added.
- The headless software-renderer timing is useful for regression detection but is not a substitute for profiling representative low-end pond hardware.
- Three.js remains the largest lazy-loaded bundle. It does not block the non-3D application shell, but Vite still reports a chunk-size warning during production build.
- The mock controller deterministically completes valid commands; failed-command behavior is verified with a contract-shaped fixture rather than random mock failures.
- The retained 2D fallback uses lightweight protocol-driven status cues and is intentionally less detailed than the 3D scene.

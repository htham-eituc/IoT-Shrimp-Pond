# Firebase Authentication Migration Plan

## Scope

This document audits the existing farmer authentication implementation and defines the smallest migration from mock authentication to Firebase Authentication with Email/Password.

This phase is documentation only. It does not change application behavior, Firebase Realtime Database contracts or rules, dashboard UX, 3D visualization, mock IoT scenarios, telemetry, settings, alerts, events, or command processing.

## Executive summary

The application already has most of the Firebase authentication mechanics needed for the migration, including Email/Password sign-in, local Firebase session persistence, `/users/{uid}` profile lookup, farmer-role validation, and pond assignment from `UserProfile.pondId`.

The main architectural issue is that authentication and pond data access are currently combined in `PondDataSource`. A single `VITE_DATA_MODE` selection chooses both:

- mock authentication plus mock pond data; or
- Firebase authentication plus Firebase pond data.

Consequently, the currently requested development combination—real Firebase Authentication with mock pond/IoT data—is not possible without also creating a mock login inside `MockPondDataSource`.

The smallest clean migration is to extract the existing authentication methods into a narrow authentication service, make Firebase the runtime authentication implementation, and continue selecting pond data independently with `VITE_DATA_MODE`. After sign-in, the authenticated user's `/users/{uid}` record supplies the only pond assignment used to scope the selected pond data source.

No dashboard feature component needs to know whether pond data comes from Firebase or the mock engine.

## 1. Current login flow

### Application bootstrap

The current application starts as follows:

```text
main.tsx
  -> App
     -> getPondDataSource()
     -> AuthProvider(dataSource)
        -> Application(dataSource)
           -> LoadingScreen, LoginScreen, or AppShell
```

`App.tsx` creates one module-level `PondDataSource` singleton. The same object is passed both to `AuthProvider` and to the authenticated dashboard.

There is no routing library. Route protection is implemented as guarded rendering:

- while the initial session is being restored, render `LoadingScreen`;
- when no session exists, render `LoginScreen`;
- when a farmer session exists, render `AppShell`.

This is adequate for the current single-page dashboard. Firebase migration does not require adding a router.

### Login submission

`LoginScreen` is a controlled and provider-neutral form. It:

- collects email and password;
- uses semantic labels and appropriate autocomplete attributes;
- calls the `signIn` function supplied by `AuthProvider`;
- clears the password field after submission;
- displays localized validation or authentication errors.

It does not import mock fixtures or Firebase directly.

`AuthProvider.signIn` currently calls `PondDataSource.signIn(email, password)`. The returned `AuthenticatedUser` is converted into a `DashboardSession`. The conversion requires `profile.role === "farmer"` and copies the profile's `pondId`; it does not derive the pond from the submitted email or from a UI constant.

### Mock mode

When `VITE_DATA_MODE=mock`, `MockPondDataSource.signIn` authenticates against a hardcoded mock farmer account. It then returns the mock database's user profile:

```json
{
  "role": "farmer",
  "pondId": "pond-001",
  "displayName": "Pond Operator"
}
```

The mock data source stores its current user internally and requires that user when authorizing all subsequent pond operations.

### Firebase mode

When `VITE_DATA_MODE=firebase`, `FirebasePondDataSource.signIn` already performs the desired security-sensitive sequence:

```text
signInWithEmailAndPassword
  -> Firebase user.uid
  -> read /users/{uid}
  -> parse UserProfile
  -> require role === "farmer"
  -> use profile.pondId
  -> return AuthenticatedUser
```

If the profile is missing, invalid, or not a farmer, the implementation signs the Firebase user out and rejects the login. This correctly prevents the dashboard from trusting a hardcoded or client-selected pond ID.

After login, `AppShell` passes `session.profile.pondId` to all existing subscriptions and data operations.

## 2. Current session persistence behavior

### Mock persistence

`MockPondDataSource` stores only a boolean login marker under:

```text
smart-shrimp-pond.mock-authenticated.v1
```

On reload it reconstructs the fixed mock UID, email, and profile from the mock database. It does not store a password.

There is also an older, separate helper in `src/auth/mockAuth.ts` using a different key:

```text
smart-shrimp-pond.mock-session.v1
```

That helper is not part of the runtime login path. It is currently used only by tests and should not be confused with `MockPondDataSource` persistence.

### Firebase persistence

`FirebasePondDataSource` configures `browserLocalPersistence`. During restoration it waits for Firebase Auth initialization, reads `auth.currentUser`, and then reloads `/users/{uid}` before creating the application session.

This supports predictable refresh/restart behavior and ensures the profile and assigned pond are revalidated rather than restored from a client-owned pond ID.

### Persistence limitation

`AuthProvider` restores the session once during initial mount. It does not currently subscribe to ongoing Firebase authentication state changes. A sign-out or account change originating in another browser tab, or an externally invalidated session, is therefore not reflected immediately until a data call fails or the page reloads.

The migration should use Firebase's authentication-state observer as the session authority. The initial route guard should remain in its loading state until the first auth callback and `/users/{uid}` lookup have completed.

### Current logout behavior

`AuthProvider.signOut` clears the React session immediately and invokes the data source's sign-out operation without awaiting it. Errors are swallowed.

For Firebase logout, the provider should await or track `FirebaseAuth.signOut()`, expose a localized failure if it cannot complete, and let the auth-state observer confirm the unauthenticated state. The UI layout and logout control do not need redesigning.

## 3. Files containing mock authentication

| File | Current role | Migration impact |
| --- | --- | --- |
| `web/src/data/MockPondDataSource.ts` | Runtime mock sign-in, restore, logout, current-user state, and pond authorization | Remove authentication responsibility; retain the RTDB-shaped mock database, scenarios, subscriptions, telemetry, settings, and commands |
| `web/src/auth/mockAuth.ts` | Older standalone mock session helper | Remove after tests use neutral session fixtures or an injected auth test double |
| `web/src/auth/mockAuth.test.ts` | Tests the older helper and its local-storage behavior | Replace with authentication-service/profile-resolution tests |
| `web/src/data/MockPondDataSource.test.ts` | Signs into the mock data source before exercising data operations | Supply an authenticated/scoped farmer context without mock login |
| `web/src/data/createPondDataSource.test.ts` | Verifies the combined mock/Firebase mode selection | Update to verify independent authentication and data composition |
| `web/src/i18n/i18n.test.tsx` | Uses `createMockSession` as a render fixture | Replace with a provider-neutral `DashboardSession` fixture |
| `web/src/components/Pond3D/pondSceneModel.test.ts` | Signs into `MockPondDataSource` before scenario tests | Scope/inject the validated farmer context instead |

The mock database's `/users` node may remain because it mirrors the documented RTDB root shape. It must no longer act as the runtime authentication authority once real Firebase Authentication is enabled.

## 4. Components depending on mock user data

No production presentation component directly imports the mock user fixture.

The dependency is indirect:

- `AuthProvider` depends on authentication methods currently exposed by `PondDataSource`.
- `App` passes the same selected data-source instance to authentication and the dashboard.
- `AppShell` depends on the generic `DashboardSession`, then scopes dashboard subscriptions with `session.profile.pondId`.
- `LoginScreen`, header, logout control, and route guard are provider-neutral.
- The scenario selector depends on mock scenario capabilities, not on mock authentication.

Tests that call `createMockSession` or `MockPondDataSource.signIn` depend on mock authentication fixtures, but this does not represent a production UI dependency.

## 5. Current coupling between authentication and pond data

### Interface coupling

`PondDataSource` currently combines two responsibilities:

```text
Authentication
  restoreSession
  signIn
  signOut
  getCurrentUser

Pond data
  pond/settings/alerts/events/commands subscriptions
  telemetry queries
  settings, pond-name, and command writes
```

Both `MockPondDataSource` and `FirebasePondDataSource` store a private current user. Both check that the requested pond ID matches `currentUser.profile.pondId` before data access.

### Configuration coupling

`createPondDataSource` uses only `VITE_DATA_MODE`:

- `mock` selects mock authentication and mock pond data;
- `firebase` selects Firebase Authentication and Firebase pond data.

There is no supported real-auth/mock-data combination.

### Firebase initialization coupling

`FirebasePondDataSource` currently initializes and owns both Firebase Auth and Realtime Database clients. The same Firebase app should remain shared, but initialization should move to a small common Firebase client module so the authentication service and Firebase pond data source can consume the clients independently.

### Authorization consideration for mock data

Firebase Realtime Database rules protect Firebase-backed data using the active Firebase user. Mock data has no server rules, so it still needs a local scope guard. That guard should use the already validated farmer profile supplied by the application composition layer. It must not perform another mock sign-in or choose its own pond.

## 6. Desired architecture

### Recommended boundary

Introduce a narrow authentication abstraction, for example:

```ts
interface AuthSource {
  observeSession(
    listener: (user: AuthenticatedUser | null) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe;
  signIn(email: string, password: string): Promise<AuthenticatedUser>;
  signOut(): Promise<void>;
}
```

The exact method names may follow existing conventions. The important boundary is that `AuthSource` owns identity and profile resolution while `PondDataSource` owns pond data only.

The runtime implementation should be `FirebaseAuthSource`. A mock runtime auth implementation is not required by the migration goal. Unit and component tests can inject a small in-memory test double without exposing fake login accounts in the application.

### Target runtime flow

```text
Firebase Authentication (Email/Password)
  -> Firebase user.uid
  -> FirebaseAuthSource reads /users/{uid}
  -> parse and validate UserProfile
  -> require role === "farmer"
  -> AuthenticatedUser.profile.pondId
  -> scope selected PondDataSource to that pond
  -> existing dashboard subscriptions and writes
```

The pond ID must never come from:

- an environment variable;
- the login form;
- local storage;
- the mock scenario engine;
- a component constant;
- a URL parameter without comparison to the authenticated profile.

### Independent data modes

Keep `VITE_DATA_MODE` for pond data selection:

| Authentication | Pond data | Intended use |
| --- | --- | --- |
| Firebase | Mock | Authenticated development/demo with local scenario engine |
| Firebase | Firebase | Integrated/production operation |

Both modes use the same `AuthenticatedUser` and its Firebase-resolved `pondId`. Only the pond data implementation changes.

An additional public `VITE_AUTH_MODE` switch is unnecessary for the stated migration because Firebase is the sole runtime authentication provider. Keeping authentication behind `AuthSource` still makes it replaceable and easy to fake in tests without maintaining a second production login mode.

### Data-source scoping

The least invasive clean option is to create or bind the pond data source only after a validated farmer session exists:

```text
AuthProvider(FirebaseAuthSource)
  -> authenticated user/profile
  -> create scoped pond source using profile.pondId
  -> AppShell(existing props and behavior)
```

The scope may be implemented by a small wrapper or by passing an immutable access context to the selected data source. It should ensure every pond operation matches the authenticated profile's assigned pond while keeping the existing feature-facing `PondDataSource` API substantially unchanged.

A general mutable `setCurrentUser` method on the raw data source should be avoided if a scoped wrapper/factory can be introduced with comparable effort.

### Shared Firebase client

Centralize Firebase initialization so that:

- `FirebaseAuthSource` receives the shared `Auth` and `Database` clients;
- `FirebasePondDataSource` receives the shared `Database` client;
- both use the same named Firebase app and authenticated SDK session;
- initialization remains lazy and safe under Vite development reloads;
- no credentials are hardcoded.

The authentication service must read `/users/{uid}` even when `VITE_DATA_MODE=mock`, because Firebase is still the authority for farmer role and pond assignment.

## 7. Smallest migration needed

The recommended implementation sequence for the next phase is:

1. Extract the existing Firebase app initialization into a shared client module without changing environment field names.
2. Add `AuthSource` and move the existing Firebase sign-in, persistence, sign-out, auth observation, and `/users/{uid}` profile lookup into `FirebaseAuthSource`.
3. Change `AuthProvider` to depend on `AuthSource`, not `PondDataSource`.
4. Remove authentication methods and current-user ownership from `PondDataSource`.
5. Scope the selected pond data source with the validated `AuthenticatedUser.profile.pondId` at the application composition boundary.
6. Remove mock authentication and its local-storage markers while retaining `MockPondDataSource` and its RTDB-shaped mock data/scenario behavior.
7. Preserve `VITE_DATA_MODE=mock|firebase` as the independent pond data switch.
8. Keep the existing guarded-rendering flow, Login screen, dashboard session shape, AppShell, feature components, command lifecycle, and scenario controls.
9. Update documentation and `.env.example` to state that Firebase configuration is required for authentication in both pond data modes.

This is a boundary extraction, not a dashboard rewrite.

## 8. Environment configuration audit

The current `.env.example` contains:

- `VITE_DATA_MODE`;
- `VITE_FIREBASE_API_KEY`;
- `VITE_FIREBASE_AUTH_DOMAIN`;
- `VITE_FIREBASE_DATABASE_URL`;
- `VITE_FIREBASE_PROJECT_ID`;
- `VITE_FIREBASE_STORAGE_BUCKET`;
- `VITE_FIREBASE_MESSAGING_SENDER_ID`;
- `VITE_FIREBASE_APP_ID`.

These are appropriate Firebase web-client configuration fields. They are identifiers/configuration, not a Firebase user password. Real farmer credentials must never be placed in Vite environment files because every `VITE_*` value is bundled for the browser.

`web/.env` is already ignored. The migration should continue committing only `.env.example` placeholders.

After migration, Firebase configuration is required even with `VITE_DATA_MODE=mock`, because authentication and `/users/{uid}` profile resolution remain real. `VITE_DATA_MODE` should describe only the source of pond operational data.

## 9. Current user and profile types

The existing domain types already match the required profile boundary:

```ts
interface UserProfile {
  role: "farmer" | "device";
  pondId: string;
  displayName: string;
}

interface AuthenticatedUser {
  uid: string;
  email: string;
  profile: UserProfile;
}
```

`FarmerProfile` narrows the role to `"farmer"`, and `DashboardSession` contains that profile. The existing `parseUserProfile` validator checks role and nonempty profile fields.

No protocol type change is required. In particular:

- do not add passwords or Firebase tokens to `UserProfile`;
- do not store authentication state below `/users/{uid}`;
- do not replace `pondId` with a UI alias;
- do not place locale or visualization preferences into this Firebase profile contract during this migration.

## 10. Tests requiring modification or addition

### Modify

| Test area | Required change |
| --- | --- |
| Old mock auth tests | Remove local-storage mock-login expectations; replace with provider-neutral session fixtures or Firebase auth-service tests |
| `MockPondDataSource` tests | Stop calling mock `signIn`; construct a source scoped by a validated farmer access context |
| Data-source factory tests | Verify data mode selection independently from authentication and cover Firebase-auth/mock-data composition |
| i18n rendering tests | Replace `createMockSession` with a neutral `DashboardSession` fixture |
| 3D scenario tests | Retain scenario assertions but inject/scoped pond access without mock login |

### Add

Focused tests should cover:

- Email/Password sign-in delegates to Firebase Auth;
- the profile is read from exactly `/users/{uid}`;
- `pondId` comes from the returned profile, not a configured or submitted value;
- a missing profile rejects access and signs out;
- a `device` role rejects web-dashboard access and signs out;
- malformed `pondId` or `displayName` rejects access;
- an existing Firebase session restores only after profile validation;
- Firebase sign-out clears the application session;
- an authentication-state change is reflected after initial load;
- a valid real-auth session can scope `MockPondDataSource` without mock login;
- mock and Firebase pond sources reject operations for a different pond ID at the client boundary;
- switching `VITE_DATA_MODE` requires no Login or feature-component changes.

Firebase SDK behavior should be tested with injected SDK adapters/emulators where practical. Tests must not require or commit real credentials.

## 11. Error and edge-state behavior for the implementation phase

The existing localized Login screen should remain the presentation point for authentication errors. The implementation phase should distinguish at least:

- invalid email/password;
- Firebase unavailable/network failure;
- authenticated Firebase account with no `/users/{uid}` record;
- invalid profile shape;
- non-farmer role;
- restored Firebase session whose profile becomes unavailable;
- sign-out failure.

Details should be logged safely for development without displaying credentials or tokens. User-facing text should remain localized through the existing Vietnamese/English layer.

If authentication succeeds but the selected pond data source fails, that is a data-availability state, not an authentication failure. The farmer session should not be replaced with a fake mock user to make pond data available.

## 12. Files expected to change during the authentication implementation phase

The exact filenames may follow current conventions, but the smallest expected set is:

- `web/src/App.tsx` — compose authentication separately from the selected/scoped pond source;
- `web/src/auth/AuthContext.ts` — adjust the async/auth-service contract if needed;
- `web/src/auth/AuthProvider.tsx` — consume `AuthSource` and observe Firebase session state;
- `web/src/auth/useAuth.ts` — only if the public context signature changes;
- `web/src/auth/mockAuth.ts` — remove obsolete runtime/test helper;
- `web/src/data/PondDataSource.ts` — remove authentication responsibilities;
- `web/src/data/MockPondDataSource.ts` — remove mock login/persistence and accept authenticated pond scope;
- `web/src/data/FirebasePondDataSource.ts` — retain pond data only and consume shared Firebase database initialization;
- `web/src/data/createPondDataSource.ts` — choose pond data independently of authentication;
- `web/src/data/index.ts` — update public exports;
- new files under `web/src/auth/` for `AuthSource` and `FirebaseAuthSource`;
- a shared Firebase initialization file under `web/src/firebase/` or the existing data infrastructure;
- `web/.env.example` — clarify that Firebase config is required for real authentication in both data modes;
- `README.md` — document the new login/composition flow;
- affected tests listed above.

`LoginScreen`, `AppShell`, dashboard feature components, Pond3D components, domain database types, Firebase rules, and IoT firmware should not require functional changes.

## 13. Migration acceptance checklist

The future implementation is complete when:

- every runtime login uses Firebase Email/Password;
- session restoration uses Firebase Auth persistence and an auth-state observer;
- every authenticated UID resolves `/users/{uid}` before the dashboard renders;
- only `role: "farmer"` can enter the web dashboard;
- the dashboard pond ID always comes from the validated profile;
- real Firebase authentication works with both mock and Firebase pond data modes;
- `PondDataSource` no longer owns login/logout/session persistence;
- no mock login marker or fake runtime user remains;
- the mock IoT engine and all existing feature behavior remain unchanged;
- no UI component branches on authentication or pond data mode;
- no password, token, or real credential is committed;
- lint, typecheck, tests, and production build pass.

## Non-goals

This migration must not:

- change Firebase Realtime Database paths, fields, or permissions;
- rewrite Firebase security rules;
- add self-registration or password-reset flows unless separately requested;
- create or provision `/users/{uid}` records from the browser;
- allow a farmer to select or edit their assigned pond ID;
- modify mock IoT scenarios or the manual command lifecycle;
- redesign the dashboard or change the 3D visualization.

# Firebase Authentication Final Status

## Status

The web application now uses Firebase Authentication Email/Password as its only
runtime authentication mechanism. A Firebase identity is not sufficient by
itself: the application loads and validates `/users/{uid}` before creating an
authorized farmer session or mounting the protected dashboard.

No Firebase credentials, passwords, tokens, or authentication bypass flags were
added to source control. Firebase Realtime Database contracts, security rules,
IoT firmware, mock scenarios, command behavior, and dashboard design were not
changed during this QA phase.

## Implementation architecture

```text
Firebase modular Web SDK
  ├─ shared named Firebase app initialization
  ├─ Firebase Auth (Email/Password + browserLocalPersistence)
  └─ Firebase Realtime Database
       └─ /users/{firebaseUser.uid}
            └─ validated AuthenticatedFarmer
                 └─ profile pondId scopes selected PondDataSource
                      ├─ MockPondDataSource
                      └─ FirebasePondDataSource
```

`AuthSource` owns authentication and farmer-profile authorization.
`PondDataSource` owns operational pond data only. `VITE_DATA_MODE` selects mock
or Firebase pond data after authorization; it cannot select a mock login.

Firebase initialization exists in one shared module. Both authentication and the
Firebase pond source reuse the same named Firebase application instance.

## Login flow

1. The user submits email and password from the bilingual Login screen.
2. The password is passed directly to the modular Firebase SDK
   `signInWithEmailAndPassword` call.
3. The form clears its password state after the attempt.
4. Firebase Auth emits the identity through `onAuthStateChanged`.
5. The application remains in its localized initializing/profile-validation view.
6. The profile at `/users/{uid}` is loaded and validated.
7. Only an authorized farmer session may mount the dashboard.

Known Firebase failures are converted to stable application error codes before
localization. Raw Firebase error messages are not rendered in the production UI.
Duplicate form submissions are disabled while an authentication request is in
progress.

## Authorization flow

The profile must satisfy the current domain contract:

```json
{
  "role": "farmer",
  "pondId": "pond-001",
  "displayName": "Pond Operator"
}
```

The example values above are documentation only. The actual profile is always
read from `/users/{firebaseUser.uid}`. Authentication/session code does not use a
hardcoded pond ID, email-derived pond ID, route parameter, or local-storage pond
assignment.

Access fails closed for each of these cases:

- `/users/{uid}` does not exist;
- `role` is `device` or any value other than `farmer`;
- `pondId` is missing, empty, or invalid;
- the remaining profile shape is malformed;
- Realtime Database denies the profile read.

The denied Firebase identity is signed out, no `PondDataSource` is created, and
no pond listeners are attached. Vietnamese and English messages exist for every
denial category.

## Authorized application session

Feature composition receives an `AuthenticatedFarmer` containing only:

- Firebase UID;
- nullable email;
- display name;
- literal farmer role;
- authorized pond ID.

It does not contain a password, refresh token, Firebase ID token, or raw Firebase
User object. Firebase SDK owns credential persistence and token refresh.

## Session restoration

`onAuthStateChanged` is the authoritative bootstrap. Until its first result and,
when applicable, profile validation complete, the top-level state is
`initializing`. The Login screen is not briefly rendered during restoration and
the dashboard is not rendered before authorization.

For a persisted Firebase user the sequence is:

```text
page reload
  -> Firebase restores browserLocalPersistence
  -> onAuthStateChanged supplies Firebase User
  -> reload /users/{uid}
  -> validate farmer and pondId
  -> create fresh dashboard session
```

The application does not implement custom token or session storage.

## Logout and account switching

Logout immediately removes the authorized application session from composition,
which unmounts the pond dashboard and its subscriptions, then calls Firebase
`signOut(auth)`. The Login screen appears after Firebase reports the signed-out
state.

The authenticated application subtree is keyed by Firebase UID. A different
account therefore receives a newly mounted AppShell and newly scoped data source.
This clears drawer/dialog state, selected demo state, pending component state,
and previous pond snapshots. The new account's `/users/{uid}` profile is loaded
again; the earlier account's pond ID is not reused.

## Listener cleanup review

- `AuthProvider` registers the `AuthSource` observer in a React effect and returns
  its unsubscribe function.
- `FirebaseAuthSource` returns the Firebase SDK observer unsubscribe and invalidates
  any in-flight profile-resolution sequence when disposed.
- React StrictMode's development mount/unmount cycle invokes the effect cleanup,
  so the first temporary observer does not remain persistent.
- `usePondDashboard` collects every RTDB unsubscribe function and calls each during
  effect cleanup.
- Its effects depend on both `dataSource` and `pondId`, causing old listeners to
  be removed when either scope changes.
- Logout renders the initializing/signing-out state instead of AppShell, forcing
  protected subscriptions to unmount before sign-out completes.
- Account UID keys the authenticated subtree, preventing state reuse between users.

Automated tests also verify observer unregistration, suppression of an in-flight
profile result after unsubscribe, signed-out state removal, account A/account B
profile resolution, and fresh mock data-source state for a later user.

## Development-bypass audit

Repository searches covered `mockAuth`, `mockUser`, `demoUser`, `fakeUser`,
`mockPassword`, `isAuthenticated = true`, `farmer@example`, `pond-001`, browser
storage, passwords, and Firebase token names.

Results:

- No runtime mock authentication module, mock credential comparison, hardcoded UID,
  authenticated flag, or login bypass remains.
- Historical `mockAuth` mentions remain only in the Phase 16 audit plan describing
  code that was subsequently removed.
- `farmer@example` remains only in `Database and Rules.md` as a documentation example.
- `pond-001` remains in mock IoT/database fixtures, unit tests, Firebase examples,
  and example metadata. It is absent from runtime authentication/session logic.
- Web `localStorage` access is limited to the locale preference. Firebase SDK owns
  its internal auth persistence; application code neither reads nor removes its keys.
- The web application does not manually store refresh tokens, Firebase ID tokens,
  or access tokens.
- No production logging statement records authentication inputs, credentials,
  profiles, or tokens.
- The Login input uses `type="password"` and `autocomplete="current-password"`.

The Firebase web configuration is intentionally supplied to browser code through
`VITE_FIREBASE_*`. It is not treated as a server secret. Authentication and
Realtime Database Security Rules remain the security boundary.

## QA cases completed

The automated suite covers:

- successful Firebase SDK login delegation;
- invalid credentials, wrong password, and unknown account mapping;
- authentication network failure mapping;
- invalid/missing Firebase configuration;
- authenticated user plus valid farmer profile;
- missing profile;
- device-role denial;
- missing pond assignment;
- malformed profile handling;
- profile-read permission denial;
- profile-validation loading state;
- signed-out Login state;
- protected dashboard allowed only with an authorized session;
- persisted-session restoration without calling sign-in again;
- active session removed when Firebase reports sign-out;
- Firebase logout delegation;
- SDK auth-observer cleanup;
- stale in-flight profile result suppression;
- account A to account B profile re-resolution;
- fresh data-source state after account switching;
- Vietnamese and English authentication error messages;
- duplicate-submission protection.

All of these tests use injected Firebase SDK-boundary adapters and require no real
credentials.

## Live Firebase verification status

A local ignored `web/.env` containing all seven Firebase web configuration fields
was detected without printing or recording their values. It does not contain a
farmer email or password, which is the required security posture.

No real farmer, device, missing-profile, or malformed-profile test-account
credentials were available to this automated workspace. Therefore these manual
operations were **not executed** against the live Firebase project:

- real farmer login, refresh, logout, and login again;
- missing-profile account denial;
- device-account denial;
- malformed-metadata account denial;
- live profile permission-denied behavior;
- browser network-disconnection behavior.

The corresponding application paths are covered by SDK-boundary automated tests,
but that does not substitute for a Firebase Console/browser smoke test. No test
accounts were created and no Firebase data or rules were modified.

## Remaining Firebase Console setup

Before deployment or demonstration, a project administrator must:

1. Enable Email/Password in Firebase Authentication.
2. Create the farmer account through Firebase Console or a trusted provisioning
   process; do not add credentials to source or Vite environment variables.
3. Create `/users/{uid}` using the exact UID of that Authentication account.
4. Set `role` to `farmer`, supply the assigned nonempty `pondId`, and provide the
   required display name.
5. Ensure the assigned pond paths exist for the intended operational data mode.
6. Apply and verify the repository's existing Realtime Database rules.
7. Run the live browser matrix above with controlled farmer/device/denied accounts.

## Verification commands

Run from `web/`:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Final results:

- `npm run lint`: passed;
- `npm run typecheck`: passed;
- `npm test`: passed, 17 test files and 98 tests;
- `npm run build`: passed;
- `git diff --check`: passed.

Repository-level audit checks also included `rg` searches for bypass/credential
patterns, `git check-ignore -v web/.env`, and `git diff --check`.

The Vite build retains the existing advisory for large Three.js chunks. It is not
an authentication failure and was not changed during this security-focused phase.

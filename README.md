# Smart Shrimp Pond

IoT shrimp-pond monitoring and control prototype using **Firebase Realtime Database**, **Firebase Authentication**, a **Vite + React + TypeScript web dashboard**, and **Wokwi** for IoT simulation.

```text
Web Dashboard ↔ Firebase Realtime Database ↔ IoT / Wokwi
                     ↑
             Firebase Authentication
```

## 1. Requirements

### Web
- Node.js 20+ and npm
- Vite + React + TypeScript dashboard
- Environment-selected `MockPondDataSource` or `FirebasePondDataSource`

### IoT
- Wokwi account or Wokwi VS Code extension
- ESP32/ESP8266 Wokwi project
- Arduino libraries used by the firmware, typically:
  - `ArduinoJson`
  - board-provided Wi-Fi / HTTP libraries

## 2. Firebase Setup

Enable the **Email/Password** sign-in provider in Firebase Authentication. Create
the farmer account through Firebase Console or another trusted provisioning
process, copy its Firebase Authentication UID, and create the matching metadata
record under:

```text
/users/{uid}
```

Example:

```json
{
  "role": "farmer",
  "pondId": "pond-001",
  "displayName": "Pond Operator"
}
```

The UID is the key in `/users/{uid}`; the browser must not choose its own UID or
pond assignment. A successfully authenticated account is denied dashboard access
when this profile is missing, malformed, assigned a non-farmer role, or lacks a
valid `pondId`.

The IoT controller uses a separate device account and metadata record, for example:

```json
{
  "role": "device",
  "pondId": "pond-001",
  "displayName": "Pond Controller"
}
```

Apply:

```text
firebase/database-example.json
firebase/database.rules.json
```

Main database paths:

```text
/ponds/{pondId}
/settings/{pondId}
/commands/{pondId}
/telemetry/{pondId}
/alerts/{pondId}
/events/{pondId}
```

## 3. Web Setup

From the web directory:

```bash
npm install
npm run dev
```

Copy `web/.env.example` to `web/.env` and provide the Firebase web configuration.
Firebase Email/Password authentication and `/users/{uid}` profile authorization
are used in every data mode. The default pond data mode is mock:

```text
VITE_DATA_MODE=mock
```

Create the Firebase Authentication account through a trusted provisioning process,
then add its authorization profile at `/users/{uid}`:

```json
{
  "role": "farmer",
  "pondId": "pond-001",
  "displayName": "Pond Operator"
}
```

The mock mode applies only to pond data and IoT scenarios; it does not provide a
mock login or hardcoded account. Set `VITE_DATA_MODE=firebase` to use Realtime
Database for operational pond data as well. Never put a farmer email or password
in a Vite environment file.

The web data flow is:

```text
Login through Firebase Authentication
→ read /users/{uid}
→ require role = farmer
→ select mock or Firebase pond data
→ subscribe to profile.pondId
→ receive real-time sensor, alert, command, and settings updates
→ create manual commands and wait for controller state feedback
```

Available web checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 4. IoT / Wokwi Setup

Configure the firmware with:

```text
Wi-Fi SSID/password
Firebase Web API key
Firebase Database URL
Device email/password
pondId
```

For Wokwi Wi-Fi:

```text
SSID: Wokwi-GUEST
Password: empty
```

Expected IoT flow:

```text
Connect Wi-Fi
→ login to Firebase
→ load /settings/{pondId}
→ read commands
→ read simulated sensors
→ apply automatic workflows
→ update /ponds/{pondId}
→ append /telemetry/{pondId}
→ create alerts/events when needed
```

## 5. Run Order

```text
1. Configure Firebase
2. Start web:
      npm install
      npm run dev
3. Start Wokwi simulation
4. Login to the dashboard
5. Verify live sensor values
6. Test a manual device command
7. Verify device state feedback
```

## 6. Secrets

Do not commit real credentials.

Recommended local files:

```text
web/.env
iot/secrets.h
```

Keep templates in Git:

```text
web/.env.example
iot/secrets.example.h
```

Add the real secret files to `.gitignore`.

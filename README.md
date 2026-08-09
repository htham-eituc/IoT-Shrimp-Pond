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
- Phase 1 web app uses Vite + React + TypeScript with mock authentication only
- Firebase Web SDK integration is planned for a later phase

### IoT
- Wokwi account or Wokwi VS Code extension
- ESP32/ESP8266 Wokwi project
- Arduino libraries used by the firmware, typically:
  - `ArduinoJson`
  - board-provided Wi-Fi / HTTP libraries

## 2. Firebase Setup

Create Firebase Authentication accounts for the dashboard user and IoT device, then create matching metadata records under:

```text
/users/{uid}
```

Example:

```json
{
  "role": "farmer",
  "pondId": "pond-001"
}
```

or:

```json
{
  "role": "device",
  "pondId": "pond-001"
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

Phase 1 implements only the dashboard foundation: reusable design tokens, mock
authentication, the authenticated shell, header context, and responsive
navigation. The mock login creates this farmer profile:

```json
{
  "role": "farmer",
  "pondId": "pond-001",
  "displayName": "Pond Operator"
}
```

Use `farmer@example.com` with any non-empty placeholder password. The mock app
stores only the mock session, never the password.

The web should:

```text
Phase 1:
Login with mock auth
→ restore or clear the local mock session predictably
→ show the assigned pond name, connection indicator, current mode, and navigation

Later phases:
Firebase login
→ read current user profile
→ subscribe to assigned pond data
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
